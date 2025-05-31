import { Effect, Layer, Queue, Deferred, Runtime, Fiber } from "effect";
import { pipe, identity } from "effect/Function";

import middy from "@middy/core";
import dontWait from "@middy/do-not-wait-for-empty-event-loop";
import { Handler } from "aws-lambda";

export type EventHandler<R, E, I, O> = (event: I) => Effect.Effect<O, E, R>;

export const create = <R, E, I, O>(handler: EventHandler<R, E, I, O>) => {
  type RequestContext<I, O> = {
    readonly event: I;
    readonly response: Deferred.Deferred<O, E>;
  };

  const queue = Effect.runSync(Queue.unbounded<RequestContext<I, O>>());

  const run: Handler<I, O> = async (event: I): Promise<O> => {
    const runtime = Runtime.defaultRuntime;
    return pipe(
      Deferred.make<O, E>(),
      Effect.tap((response) => Queue.offer(queue, { event, response })),
      Effect.flatMap(Deferred.await),
      Effect.sandbox,
      Runtime.runPromise(runtime)
    );
  };

  const _main = Effect.gen(function* () {
    return yield* pipe(
      // poll from the request queue waiting in case no requests are present
      Queue.take(queue),
      // fork each request in it's own fiber and start processing
      // here we are forking inside the parent scope so in case the
      // parent is interrupted each of the child will also trigger
      // interruption
      Effect.flatMap(({ event, response }) => 
        Effect.fork(pipe(
          handler(event),
          Effect.flatMap((result) => Deferred.succeed(response, result)),
          Effect.catchAll((error) => Deferred.fail(response, error))
        ))
      ),
      // loop forever
      Effect.forever,
      // handle teardown
      Effect.ensuring(
        pipe(
          Queue.takeAll(queue),
          Effect.tap(() => Queue.shutdown(queue)),
          Effect.flatMap(Effect.forEach(({ response }) => Deferred.interrupt(response), { concurrency: "unbounded" }))
        )
      )
    );
  });

  const _handler = middy(run as Handler<I, O>).use(dontWait()) as Handler<I, O>;

  return { handler: _handler, main: _main };
};

// Enhanced run function with better error handling and graceful shutdown
export function run<R, E, I, O>(
  program: EventHandler<R, E, I, O>, 
  environment: Layer.Layer<R>,
  options: {
    readonly runtime?: Runtime.Runtime<never>;
    readonly onError?: (error: unknown) => Effect.Effect<void>;
    readonly timeout?: number;
  } = {}
) {
  const { handler, main } = create(program);
  const runtime = options.runtime ?? Runtime.defaultRuntime;
  
  // Enhanced main program with error handling
  const mainWithErrorHandling = pipe(
    main,
    Effect.provide(environment),
    Effect.catchAllCause((cause) => {
      if (options.onError) {
        return pipe(
          options.onError(cause),
          Effect.orElse(() => Effect.logError("Lambda handler error", cause))
        );
      }
      return Effect.logError("Lambda handler error", cause);
    }),
    options.timeout ? Effect.timeout(options.timeout) : identity
  );

  // Start the process engine with proper error handling
  const fiber = Runtime.runFork(runtime)(mainWithErrorHandling);
  
  // Add graceful shutdown on process termination
  const cleanup = () => {
    Runtime.runSync(runtime)(Fiber.interrupt(fiber));
  };
  
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
  process.on('beforeExit', cleanup);

  return handler;
}

// Simplified run function for backward compatibility
export function runSimple<R, E, I, O>(program: EventHandler<R, E, I, O>, environment: Layer.Layer<R>) {
  return run(program, environment);
}
