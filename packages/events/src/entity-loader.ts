import * as T from "@effect-ts/core/Effect";
import { pipe } from "@effect-ts/core";
import * as Case from "@effect-ts/core/Case";

import { EntityService } from "./entity-service";
import { AggregateId, Entity, Payload } from "./types";

export interface EntityLoader {
  load(aggregate: AggregateId): T.Effect<unknown, EntityLoader.Error, Entity>;
}

export namespace EntityLoader {
  type NotServiced = "not-serviced";
  type NotFound = "not-found";
  type LoaderError = "loader-error";

  export type Cause = NotFound | NotServiced | LoaderError;

  export class Error extends Case.Tagged(Symbol())<{ readonly type: Cause; readonly root?: unknown }> {
    readonly isNotFound = this.type === "not-found";

    static notFound = new Error({ type: "not-found" });
    static noteServiced = new Error({ type: "not-serviced" });
    static loaderError = (root: unknown) => new Error({ type: "loader-error", root });
  }

  export const isLoaderError = (v: unknown): v is Error => {
    return v instanceof Error;
  };

  export const fromServices = (services: Record<string, EntityService<Payload>>): T.UIO<EntityLoader> => {
    return T.succeed({
      load(aggregate: AggregateId): T.Effect<unknown, EntityLoader.Error, Entity> {
        const service = services[aggregate.type];
        if (service === undefined) {
          return T.fail(Error.noteServiced);
        }

        return pipe(
          T.tryPromise(() => service.load(aggregate)),
          T.catchAll((e) => T.fail(Error.loaderError(e))),
          T.chain((v) => (v !== undefined ? T.succeed(v) : T.fail(Error.notFound)))
        );
      },
    });
  };
}
