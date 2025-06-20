import * as fast from "fastify";
import errors from "http-errors";
import _ from "lodash";
import scalarFastifyApiReference from "@scalar/fastify-api-reference";

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

import { createOpenAPIGenerator } from "./openapi";

// Server options
export interface ServerOptions {
  openAPI?: boolean; // Default: true
  errorMapper?: (error: unknown) => errors.HttpError; // Default: standard mapper
}

export function create<R extends Environment, S extends State>(
  description: ServiceDescription<R, S>,
  options?: ServerOptions
) {
  const {
    openAPI = true,
    errorMapper = (e: unknown) => new errors.InternalServerError(e instanceof Error ? e.message : `${e}`),
  } = options || {};

  return async (store: EventStore, environment: Omit<R, "publish">): Promise<fast.FastifyInstance> => {
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

    type Id = { id: string };
    const app = fast.fastify();

    // Register OpenAPI documentation endpoints if enabled
    if (openAPI) {
      const openAPIGenerator = createOpenAPIGenerator(description);
      const schema = openAPIGenerator.generateOpenAPISchema();

      // Register OpenAPI JSON endpoint
      app.get("/openapi/schema.json", async (_req, _res) => {
        return schema;
      });

      // Register Scalar documentation UI
      await app.register(scalarFastifyApiReference, {
        routePrefix: "/openapi/documentation",
        configuration: {
          url: "/openapi/schema.json",
          theme: "purple",
          metaData: {
            title: `${description.info().title || `${_.upperFirst(et)} Service`} API Documentation`,
            description: description.info().description || `Event-sourced ${et} management service`,
          },
        },
      });

      // Add convenience redirect from /openapi to /openapi/documentation
      app.get("/openapi", async (_req, res) => {
        res.redirect("/openapi/documentation");
      });
    }

    // Register entity and command endpoints
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
