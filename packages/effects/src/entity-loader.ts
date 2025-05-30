import { Effect, pipe, Data } from "effect";

import { AggregateId, Entity, Payload, Service } from "@weegigs/events-core";

export interface EntityLoader {
  load(aggregate: AggregateId): Effect.Effect<Entity, EntityLoader.Error>;
}

export namespace EntityLoader {
  type NotServiced = "not-serviced";
  type NotFound = "not-found";
  type LoaderError = "loader-error";

  export type Cause = NotFound | NotServiced | LoaderError;

  export class Error extends Data.TaggedError("EntityLoaderError")<{
    readonly type: Cause;
    readonly root?: unknown;
  }> {}

  export const notFound = new Error({ type: "not-found" });
  export const notServiced = new Error({ type: "not-serviced" });
  export const loaderError = (root: unknown) => new Error({ type: "loader-error", root });

  export const isLoaderError = (v: unknown): v is Error => {
    return v instanceof Error;
  };

  export const fromServices = (services: Record<string, Service<Payload>>): Effect.Effect<EntityLoader> => {
    return Effect.succeed({
      load(aggregate: AggregateId): Effect.Effect<Entity, EntityLoader.Error> {
        const service = services[aggregate.type];
        if (service === undefined) {
          return Effect.fail(notServiced);
        }

        return pipe(
          Effect.tryPromise(() => service.load(aggregate)),
          Effect.catchAll((e) => Effect.fail(loaderError(e))),
          Effect.flatMap((v) => (v !== undefined && v !== null ? Effect.succeed(v) : Effect.fail(notFound)))
        );
      },
    });
  };
}
