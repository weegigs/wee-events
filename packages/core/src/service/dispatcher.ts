import * as z from "zod";

import { EventStore } from "../store";
import { Entity, Payload } from "../types";
import { State } from "./state";

export type Command = Payload;

export type Environment = Record<string, unknown>;

export type Publisher = { publish: EventStore.Publisher };

export type Handler<R extends Environment, S extends State, C extends Command> = (
  environment: R,
  entity: Entity<S>,
  command: C
) => Promise<void>;

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

const validate = <T>(schema: z.Schema<T>, value: unknown): T => {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new CommandValidationError(result.error);
  }

  return result.data;
};

export interface Dispatcher<S extends State> {
  dispatch(path: string, entity: Entity<S>, command: Command): Promise<void>;
}

export namespace Dispatcher {
  export interface Description {
    commands: Record<string, z.Schema<Payload>>;
  }
}

export interface DispatcherDescription<R extends Environment, S extends State> {
  commands(): Record<string, z.Schema<Payload>>;
  dispatcher(environment: R): Dispatcher<S>;
}

export namespace DispatcherDescription {
  class Factory<R extends Environment, S extends State> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private handlers: Record<string, { schema: z.Schema<any>; handler: Handler<any, S, any> }> = {};

    constructor(
      path: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      schema: z.Schema<any>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: Handler<R, S, any>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      existing: Record<string, { schema: z.Schema<any>; handler: Handler<any, S, any> }> = {}
    ) {
      this.handlers = {
        ...existing,
        [path]: { schema, handler },
      };
    }

    handler: <R1 extends Environment, C extends Payload>(
      path: string,
      schema: z.ZodType<C, z.ZodTypeDef, C>,
      handler: Handler<R1, S, C>
    ) => Factory<R & R1, S> = <R1 extends Environment, C extends Payload>(
      path: string,
      schema: z.ZodType<C, z.ZodTypeDef, C>,
      handler: Handler<R1, S, C>
    ) => {
      return new Factory<R & R1, S>(path, schema, handler, this.handlers);
    };

    description: () => DispatcherDescription<R, S> = () => {
      return {
        dispatcher: (environment: R) => ({
          dispatch: async (path: string, entity: Entity<S>, command: Payload) => {
            const handler = this.handlers[path];

            if (!handler) {
              throw new HandlerNotFound(path);
            }

            await handler.handler(environment, entity, validate(handler.schema, command));
          },
        }),
        commands: () => Object.fromEntries(Object.entries(this.handlers).map(([path, { schema }]) => [path, schema])),
      };
    };
  }

  /**
   * Creates a dispatch factory that can be used to create a dispatcher
   *
   * @param path the path to connect the handler to
   * @param schema the zod schema used to validate the command
   * @param handler the handler used to execute the command
   * @returns a dispatch factory that can be used to create a dispatcher
   */
  export function handler<R extends Environment, S extends State, P extends string, C extends Command>(
    path: P,
    schema: z.Schema<C>,
    handler: Handler<R, S, C>
  ): Factory<R, S> {
    return new Factory(path, schema, handler, {});
  }
}

type HF<R extends Environment, P extends string, S extends State, C extends Command> = {
  path: P;
  schema: z.ZodType<C, z.ZodTypeDef, C>;
  handler: Handler<R, S, C>;
};

export function cf<R extends Environment, P extends string, S extends State, C extends Command>(
  hf: HF<R, P, S, C>
): (environment: R, path: P, state: Entity<S>, command: C) => Promise<void> {
  return async (environment: R, _path: P, state: Entity<S>, command: C) => {
    hf.handler(environment, state, validate(hf.schema, command));
  };
}
