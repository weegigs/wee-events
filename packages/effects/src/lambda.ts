import * as T from "@effect-ts/core/Effect";
import * as L from "@effect-ts/core/Effect/Layer";
import * as Q from "@effect-ts/core/Effect/Queue";
import * as P from "@effect-ts/core/Effect/Promise";

import * as R from "@effect-ts/node/Runtime";

import { pipe } from "@effect-ts/core";

import middy from "@middy/core";
import dontWait from "@middy/do-not-wait-for-empty-event-loop";
import { Handler } from "aws-lambda";

export type EventHandler<R, E, I, O> = (event: I) => T.Effect<R, E, O>;

export const create = <R, E, I, O>(handler: EventHandler<R, E, I, O>) => {
  type RequestContext<I, O> = {
    readonly event: I;
    readonly response: P.Promise<E, O>;
  };

  const queue = Q.unsafeMakeUnbounded<RequestContext<I, O>>();

  const run: Handler<I, O> = async (event: I): Promise<O> => {
    return pipe(
      P.make<E, O>(),
      T.tap((response) => Q.offer({ event, response })(queue)),
      T.chain(P.await),
      T.sandbox,
      R.runPromise
    );
  };

  const _main = T.accessM((environment: R) =>
    pipe(
      // poll from the request queue waiting in case no requests are present
      Q.take(queue),
      // fork each request in it's own fiber and start processing
      // here we are forking inside the parent scope so in case the
      // parent is interrupted each of the child will also trigger
      // interruption
      T.chain(({ event, response }) => T.fork(P.complete(T.provideAll(environment)(handler(event)))(response))),
      // loop forever
      T.forever,
      // handle teardown
      T.ensuring(
        pipe(
          Q.takeAll(queue),
          T.tap(() => Q.shutdown(queue)),
          T.chain(T.forEachPar(({ response }) => T.to(response)(T.interrupt)))
        )
      )
    )
  );

  const _handler = middy(run as any).use(dontWait()) as Handler<I, O>;

  return { handler: _handler, main: _main };
};

export function run<R, E, I, O>(program: EventHandler<R, E, I, O>, environment: L.Layer<unknown, unknown, R>) {
  const { handler, main } = create(program);

  // start the process engine
  R.runMain(pipe(main, T.provideLayer(environment)));

  return handler;
}
