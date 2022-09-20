import * as z from "zod";
import * as schema from "@asteasolutions/zod-to-openapi";
import * as yaml from "yaml";
import * as cc from "change-case";

import { ServiceDescription } from "./service/service";
import { Payload, Revision } from "@weegigs/events-core";

schema.extendZodWithOpenApi(z);

export const spec = <S extends Payload>(service: ServiceDescription<any, any, S>): string => {
  const {
    entity: { name },
    title,
    version,
    description,
  } = service.info;

  const registry = new schema.OpenAPIRegistry();
  const commands = service.commands();

  z.intersection;

  const $resource = registry.register(
    "Resource",
    z
      .object({ $self: z.string().url(), $type: z.string().min(1), $revision: Revision.schema })
      .openapi({ description: "An object with a type discriminator, location and revision" })
  );

  const resource = registry.register(
    cc.pascalCase(name),
    z.intersection($resource, service.info.entity.schema).openapi({ description: `A ${cc.pascalCase(name)} Resource` })
  );

  const notFound = registry.register(
    "NotFound",
    z
      .object({
        code: z.literal("404"),
        message: z.literal(`${name} not found`),
      })
      .openapi({
        description: `The requested ${name} was not found`,
      })
  );

  const conflict = registry.register(
    "Conflict",
    z
      .object({
        code: z.literal("409"),
        message: z.literal("conflict detected while processing request"),
      })
      .openapi({
        description: "The request could not be completed due to a conflict",
      })
  );

  const rateLimit = registry.register(
    "RateLimit",
    z
      .object({
        code: z.literal("429"),
        message: z.literal("rate limit exceeded"),
      })
      .openapi({
        description: "The request could not be completed due to a rate limit",
      })
  );

  const Id = registry.registerParameter(
    `${cc.pascalCase(name)}Id`,
    z.string().openapi({
      param: {
        name: "id",
        in: "path",
      },
      example: "1212121",
    })
  );

  registry.registerPath({
    path: `${name}/{id}`,
    method: "get",
    request: {
      params: z.object({ id: Id }),
    },
    responses: {
      200: {
        mediaType: "application/json",
        schema: resource,
      },
      404: {
        mediaType: "application/json",
        schema: notFound,
      },
      429: {
        mediaType: "application/json",
        schema: rateLimit,
      },
    },
  });

  for (const command in commands) {
    const ref = registry.register(cc.pascalCase(command), commands[command]);

    registry.registerPath({
      method: "post",
      path: `${name}/{id}/${command}`,
      request: {
        params: z.object({ id: Id }),
        body: ref,
      },
      responses: {
        200: {
          mediaType: "application/json",
          schema: resource,
        },
        404: {
          mediaType: "application/json",
          schema: notFound,
        },
        409: {
          mediaType: "application/json",
          schema: conflict,
        },
        429: {
          mediaType: "application/json",
          schema: rateLimit,
        },
      },
    });
  }

  const generator = new schema.OpenAPIGenerator(registry.definitions);

  const serviceName = title ?? `${cc.capitalCase(name)} Service`;
  const info =
    undefined != description ? { title: serviceName, version, description } : { title: serviceName, version };
  const api = generator.generateDocument({
    openapi: "3.0.0",
    info,
  });

  return yaml.stringify(api, null, 2);
};
