import * as fast from "fastify";
import errors from "http-errors";
import _ from "lodash";

import {
  AggregateId,
  Command,
  CommandValidationError,
  EntityNotAvailableError,
  Environment,
  EventStore,
  HandlerNotFound,
  ServiceDescription,
  State,
} from "@weegigs/events-core";

export function create<R extends Environment, S extends State>(
  description: ServiceDescription<R, S>,
  errorMapper: (error: unknown) => errors.HttpError = (e) =>
    new errors.InternalServerError(e instanceof Error ? e.message : `${e}`)
) {
  return (store: EventStore, environment: Omit<R, "publish">): fast.FastifyInstance => {
    const service = description.service(store, environment);
    const et = description.info().entity.type;

    const get = (id: AggregateId) => {
      try {
        return service.load(id);
      } catch (e) {
        if (e instanceof EntityNotAvailableError) {
          return new errors.NotFound(e.message);
        }

        return errorMapper(e);
      }
    };

    const execute = (path: string, target: AggregateId, command: Command) => {
      try {
        return service.execute(path, target, command);
      } catch (e) {
        if (e instanceof EntityNotAvailableError) {
          new errors.NotFound(e.message);
        }

        if (e instanceof CommandValidationError) {
          return new errors.BadRequest(e.message);
        }

        if (e instanceof HandlerNotFound) {
          new errors.InternalServerError(e.message);
        }

        return errorMapper(e);
      }
    };
    type Id = {
      id: string;
    };

    const app = fast.fastify();

    app.get<{ Params: Id }>(`/${et}/:id`, async (req, _res) => {
      const id = { type: et, key: req.params.id as string };

      return get(id);
    });

    for (const [command, schema] of _.toPairs(description.commands())) {
      app.post<{ Params: Id }>(`/${et}/:id/${command}`, async (req, _res) => {
        const id = { type: et, key: req.params.id as string };
        const payload = schema.safeParse(req.body);
        if (!payload.success) {
          return new errors.BadRequest(payload.error.message);
        }
        execute(command, id, payload.data);
      });
    }

    return app;
  };
}
