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

    const get = async (id: AggregateId) => {
      try {
        return await service.load(id);
      } catch (e) {
        if (e instanceof EntityNotAvailableError) {
          throw new errors.NotFound(e.message);
        }

        throw errorMapper(e);
      }
    };

    const execute = async (path: string, target: AggregateId, command: Command) => {
      try {
        return await service.execute(path, target, command);
      } catch (e) {
        if (e instanceof EntityNotAvailableError) {
          throw new errors.NotFound(e.message);
        }

        if (e instanceof CommandValidationError) {
          throw new errors.BadRequest(e.message);
        }

        if (e instanceof HandlerNotFound) {
          throw new errors.InternalServerError(e.message);
        }

        throw errorMapper(e);
      }
    };
    type Id = {
      id: string;
    };

    const app = fast.fastify();

    app.get<{ Params: Id }>(`/${et}/:id`, async (req, _res) => {
      const id = { type: et, key: req.params.id as string };

      return await get(id);
    });

    for (const [command, schema] of _.toPairs(description.commands())) {
      app.post<{ Params: Id }>(`/${et}/:id/${command}`, async (req, _res) => {
        const id = { type: et, key: req.params.id as string };
        const payload = schema.safeParse(req.body);
        if (!payload.success) {
          throw new errors.BadRequest(payload.error.message);
        }
        return await execute(command, id, payload.data);
      });
    }

    return app;
  };
}
