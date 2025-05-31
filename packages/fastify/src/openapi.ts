import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import _ from "lodash";
import type { OpenAPIObject } from "openapi3-ts/oas31";

import {
  ServiceDescription,
  Environment,
  State,
} from "@weegigs/events-core";

// Enable OpenAPI extensions for Zod
extendZodWithOpenApi(z);

// Standard response schemas using core types
const AggregateIdSchema = z.object({
  type: z.string(),
  key: z.string()
}).openapi({
  title: "AggregateId",
  description: "Unique identifier for an aggregate"
});

// Create a new extended schema from the core schema
const RevisionSchema = z.string().min(26).max(26).openapi({
  title: "Revision",
  description: "Entity revision (26-character string)"
});

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number().int()
}).openapi({
  title: "ErrorResponse",
  description: "Standard error response"
});

export class OpenAPIGenerator<R extends Environment, S extends State> {
  private registry: OpenAPIRegistry;
  private entityType: string;
  private serviceInfo: ReturnType<ServiceDescription<R, S>["info"]>;

  constructor(private description: ServiceDescription<R, S>) {
    this.registry = new OpenAPIRegistry();
    this.serviceInfo = description.info();
    this.entityType = this.serviceInfo.entity.type;
    
    this.registerStandardSchemas();
    this.registerEntitySchemas();
    this.registerCommandSchemas();
    this.registerPaths();
  }

  private registerStandardSchemas() {
    this.registry.register("AggregateId", AggregateIdSchema);
    this.registry.register("Revision", RevisionSchema);
    this.registry.register("ErrorResponse", ErrorResponseSchema);
  }

  private registerEntitySchemas() {
    // Register the entity state schema
    const entitySchema = this.serviceInfo.entity.schema;
    this.registry.register(`${_.upperFirst(this.entityType)}State`, entitySchema);

    // Create a new schema with OpenAPI metadata based on the Entity schema from core
    // Since Entity.schema returns a Zod object schema, we need to recreate it with OpenAPI support
    const entityResponseSchema = z.object({
      id: z.object({
        type: z.string(),
        key: z.string()
      }),
      type: z.string(),
      revision: RevisionSchema,
      state: entitySchema
    }).openapi({
      title: `${_.upperFirst(this.entityType)}Response`,
      description: `Complete ${this.entityType} entity with metadata`
    });

    this.registry.register(`${_.upperFirst(this.entityType)}Response`, entityResponseSchema);
  }

  private registerCommandSchemas() {
    const commands = this.description.commands();
    
    Object.entries(commands).forEach(([commandName, schema]) => {
      const schemaName = `${_.upperFirst(_.camelCase(commandName))}Command`;
      this.registry.register(schemaName, schema);
    });
  }

  private registerPaths() {
    const commands = this.description.commands();
    const entityType = this.entityType;

    // Register GET /{entityType}/{id} path
    this.registry.registerPath({
      method: "get",
      path: `/${entityType}/{id}`,
      description: `Get ${entityType} by ID`,
      summary: `Retrieve ${entityType} state`,
      tags: [_.upperFirst(entityType)],
      request: {
        params: z.object({
          id: z.string().openapi({
            description: `${_.upperFirst(entityType)} identifier`,
            example: "example-123"
          })
        })
      },
      responses: {
        200: {
          description: `${_.upperFirst(entityType)} found`,
          content: {
            "application/json": {
              schema: { $ref: `#/components/schemas/${_.upperFirst(entityType)}Response` }
            }
          }
        },
        404: {
          description: `${_.upperFirst(entityType)} not found`,
          content: {
            "application/json": {
              schema: ErrorResponseSchema
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: ErrorResponseSchema
            }
          }
        }
      }
    });

    // Register command paths
    Object.entries(commands).forEach(([commandName, schema]) => {
      this.registry.registerPath({
        method: "post",
        path: `/${entityType}/{id}/${commandName}`,
        description: `Execute ${commandName} command`,
        summary: `${_.startCase(commandName)}`,
        tags: [_.upperFirst(entityType)],
        request: {
          params: z.object({
            id: z.string().openapi({
              description: `${_.upperFirst(entityType)} identifier`,
              example: "example-123"
            })
          }),
          body: {
            content: {
              "application/json": {
                schema: schema
              }
            }
          }
        },
        responses: {
          200: {
            description: "Command executed successfully",
            content: {
              "application/json": {
                schema: { $ref: `#/components/schemas/${_.upperFirst(entityType)}Response` }
              }
            }
          },
          400: {
            description: "Business rule violation or invalid input",
            content: {
              "application/json": {
                schema: ErrorResponseSchema
              }
            }
          },
          404: {
            description: `${_.upperFirst(entityType)} not found`,
            content: {
              "application/json": {
                schema: ErrorResponseSchema
              }
            }
          },
          500: {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: ErrorResponseSchema
              }
            }
          }
        }
      });
    });
  }

  generateOpenAPISchema(): OpenAPIObject {
    const generator = new OpenApiGeneratorV31(this.registry.definitions);
    
    return generator.generateDocument({
      openapi: "3.1.0",
      info: {
        title: this.serviceInfo.title || `${_.upperFirst(this.entityType)} Service`,
        version: this.serviceInfo.version,
        description: this.serviceInfo.description || `Event-sourced ${this.entityType} management service`
      },
      servers: [
        {
          url: "/",
          description: "Local server"
        }
      ],
      tags: [
        {
          name: _.upperFirst(this.entityType),
          description: `${_.upperFirst(this.entityType)} management operations`
        }
      ]
    });
  }
}

export function createOpenAPIGenerator<R extends Environment, S extends State>(
  description: ServiceDescription<R, S>
): OpenAPIGenerator<R, S> {
  return new OpenAPIGenerator(description);
}