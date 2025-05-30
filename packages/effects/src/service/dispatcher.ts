import * as wee from "@weegigs/events-core";

import * as z from "zod";

import * as Effect from "effect/Effect";
import { pipe } from "effect";

type Payload = wee.Payload;

export type Command = wee.Payload;

export type Handler<R, E, S extends Payload, C extends Command> = (
  entity: wee.Entity<S>,
  command: C
) => Effect.Effect<void, E, R>;

export type ValidationError = z.ZodError;

export class CommandValidationError extends Error {
  constructor(public readonly error: ValidationError) {
    super("command validation failed");
    this.name = "CommandValidationError";

    Object.setPrototypeOf(this, CommandValidationError.prototype);
  }
}

export class HandlerNotFound extends Error {
  constructor(public readonly path: string) {
    super(`Handler not found for path ${path}`);
    this.name = "HandlerNotFound";

    Object.setPrototypeOf(this, HandlerNotFound.prototype);
  }
}

const validate = <T>(schema: z.Schema<T>, value: T): Effect.Effect<T, CommandValidationError> => {
  return Effect.suspend(() => {
    const result = schema.safeParse(value);
    if (!result.success) {
      return Effect.fail(new CommandValidationError(result.error));
    }

    return Effect.succeed(result.data);
  });
};

function validated<R, E, S extends Payload, C extends Payload>(
  schema: z.Schema<C>,
  handler: Handler<R, E, S, C>
): Handler<R, E | CommandValidationError, S, C> {
  return (entity: wee.Entity<S>, command: C) =>
    pipe(
      Effect.Do,
      Effect.bind("command", () => validate(schema, command)),
      Effect.bind("result", () => handler(entity, command)),
      Effect.map(({ result }) => result)
    );
}

export type Target<T extends Payload = Payload> = wee.Entity<T> | wee.AggregateId;

export interface Dispatcher<R, E, State extends Payload> {
  dispatch(
    path: string,
    entity: Target<State>,
    command: Command
  ): Effect.Effect<void, E | HandlerNotFound | CommandValidationError, R>;

  handler: <R1, E1, C extends Command>(
    path: string,
    schema: z.Schema<C>,
    h: Handler<R1, E1, State, C>
  ) => Dispatcher<R & R1, E | E1, State>;

  commands: () => Record<string, z.Schema<Payload>>;
}

type Handlers<R, E, State extends Payload> = Record<
  string,
  { schema: z.Schema<unknown>; handler: Handler<R, E, State, Command> }
>;

export namespace Dispatcher {
  const $make = <R, E, State extends Payload>(handlers: Handlers<R, E, State> = {}): Dispatcher<R, E, State> => {
    const dispatch = (
      path: string,
      entity: wee.Entity<State>,
      command: Command
    ): Effect.Effect<void, E | HandlerNotFound | CommandValidationError, R> => {
      const handler = handlers[path];
      if (undefined == handler) {
        return Effect.fail(new HandlerNotFound(path));
      }

      return handler.handler(entity, command);
    };

    const handler = <R1, E1, C extends Command>(
      path: string,
      schema: z.Schema<C>,
      h: Handler<R1, E1, State, C>
    ): Dispatcher<R & R1, E | E1, State> => {
      const y = {
        [path]: { schema, handler: validated(schema, h) },
      };

      const x = {
        ...handlers,
        ...y,
      } as Handlers<R & R1, E | E1, State>;

      return $make(x);
    };

    const commands = () => {
      const result: Record<string, z.Schema> = {};

      for (const path in handlers) {
        result[path] = handlers[path].schema;
      }

      return result;
    };

    return {
      dispatch,
      commands,
      handler,
    };
  };

  export const create = <State extends Payload>(): Dispatcher<unknown, never, State> => $make({});
}
