import _ from "lodash";

import * as T from "@effect-ts/core/Effect";
// import * as L from "@effect-ts/core/Effect/Layer";
import { pipe } from "@effect-ts/core/Function";

import * as fast from "fastify";
import * as errors from "http-errors";

import { Payload, Revision } from "@weegigs/events-core";
import { ServiceDescription, State } from "@weegigs/events-effects/lib/service/service";
import { EntityNotAvailableError } from "@weegigs/events-effects/lib/service/loader";
import { EventLoader, LoaderError } from "@weegigs/events-effects/lib/event-store";

import { Has } from "@effect-ts/core/Has";
import { AggregateId } from "@weegigs/events-core";
import { CommandValidationError, HandlerNotFound } from "@weegigs/events-effects/lib/service/dispatcher";

// export function run<R, E, A extends State>(environment: L.Layer<unknown, unknown, R & Has<EventLoader>>) {}

export function create<R, E, A extends State>(
  description: ServiceDescription<R, E, A>,
  errorMapper: (error: E) => errors.HttpError = (e) =>
    new errors.InternalServerError(e instanceof Error ? e.message : String(e))
): T.Effect<R & Has<EventLoader>, never, fast.FastifyInstance> {
  const service = description.service();
  const et = description.info.entity.name;

  const get = (id: AggregateId) =>
    pipe(
      service.load(id),
      T.map((e): T.Effect<unknown, never, errors.HttpError | ({ $type: string; $revision: string } & A)> => {
        return Revision.isInitial(e.revision)
          ? T.succeed(new errors.NotFound())
          : T.succeed({
              $type: e.type,
              $revision: e.revision,
              ...e.state,
            });
      }),
      T.flatten,
      T.catchAll((e): T.Effect<unknown, never, errors.HttpError> => {
        if (e instanceof EntityNotAvailableError) {
          return T.succeed(new errors.NotFound(e.message));
        }

        return T.succeed(new errors.InternalServerError(e.message));
      })
    );

  const execute = (path: string, target: AggregateId, command: Payload) =>
    pipe(
      service.execute(path, target, command),
      T.map((e) => ({
        $type: e.type,
        $revision: e.revision,
        ...e.state,
      })),
      T.catchAll((e) => {
        if (e instanceof EntityNotAvailableError) {
          return T.succeed(new errors.NotFound(e.message));
        }

        if (e instanceof CommandValidationError) {
          return T.succeed(new errors.BadRequest(e.message));
        }

        if (e instanceof HandlerNotFound || e instanceof LoaderError) {
          return T.succeed(new errors.InternalServerError(e.message));
        }

        return T.succeed(errorMapper(e));
      })
    );

  type Id = {
    id: string;
  };

  return T.access((environment: R & Has<EventLoader>) => {
    const app = fast.fastify();
    app.get<{ Params: Id }>(`/${et}/:id`, async (req, _res) => {
      const id = { type: et, key: req.params.id as string };

      try {
        const program = pipe(get(id), T.provideAll(environment));
        return await T.runPromise(program);
      } catch (e) {
        return new errors.InternalServerError(e instanceof Error ? e.message : String(e));
      }
    });

    for (const [command, schema] of _.toPairs(description.commands())) {
      app.post<{ Params: Id }>(`/${et}/:id/${command}`, async (req, _res) => {
        const id = { type: et, key: req.params.id as string };
        const payload = schema.safeParse(req.body);
        if (!payload.success) {
          return T.succeed(new errors.BadRequest(payload.error.message));
        }
        try {
          const program = pipe(execute(command, id, payload.data), T.provideAll(environment));
          return await T.runPromise(program);
        } catch (e) {
          return new errors.InternalServerError(e instanceof Error ? e.message : String(e));
        }
      });
    }

    return app;
  });
}
