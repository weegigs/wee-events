import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  MemoryStore,
  Entity,
  DespatcherDescription,
  LoaderDescription,
  ServiceDescription,
  Publisher,
} from "@weegigs/events-core/lib";
import { create } from "./server";

namespace Receipt {
  export const schema = z.object({
    total: z.number(),
  });
}
type Receipt = z.infer<typeof Receipt.schema>;

namespace Commands {
  export namespace Add {
    export const schema = z.object({ amount: z.number() });
    export const handler = async (environment: Publisher, entity: Entity<Receipt>, command: Add) => {
      const { publish } = environment;
      if (command.amount !== 0) {
        await publish(entity.aggregate, { type: "added", data: { amount: command.amount } });
      }
    };
  }
  export type Add = z.infer<typeof Add.schema>;

  export namespace Deduct {
    export const schema = z.object({ amount: z.number() });
    export const handler = async (environment: Publisher, entity: Entity<Receipt>, command: Deduct) => {
      const { publish } = environment;
      if (command.amount > entity.state.total) {
        throw new Error("Insufficient funds");
      }
      if (command.amount !== 0) {
        await publish(entity.aggregate, { type: "deducted", data: { amount: command.amount } });
      }
    };
  }
  export type Deduct = z.infer<typeof Deduct.schema>;
}

describe("fastify server", () => {
  const id = { key: "test", type: "receipt" };
  const ms = new MemoryStore();
  let server: FastifyInstance;

  const loader = LoaderDescription.fromInitFunction<Receipt>({ type: "receipt", schema: Receipt.schema }, () => ({
    total: 0,
  }))
    .reducer("added", z.object({ amount: z.number() }), (state, event) => ({
      ...state,
      total: state.total + event.data.amount,
    }))
    .reducer("deducted", z.object({ amount: z.number() }), (state, event) => ({
      ...state,
      total: state.total - event.data.amount,
    }))
    .description();

  const dispatcher = DespatcherDescription.handler("add", Commands.Add.schema, Commands.Add.handler)
    .handler("deduct", Commands.Deduct.schema, Commands.Deduct.handler)
    .description();

  const description = ServiceDescription.create(
    { title: "receipt", description: "receipt service", version: "1.0.0" },
    loader,
    dispatcher
  );

  beforeAll(async () => {
    const serverFactory = create(description, { openAPI: false });
    server = await serverFactory(ms, {});
    await server.ready();
  });

  beforeEach(() => ms.clear());

  afterAll(async () => {
    await server.close();
  });

  it("should create a server from a service description", async () => {
    expect(server).toBeDefined();
    expect(server.inject).toBeDefined();
  });

  it("should return a 200 if the entity is not found", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/receipt/missing",
    });

    expect(response).toBeDefined();
    expect(response.statusCode).toEqual(200); // Empty entity should return default state
    expect(JSON.parse(response.body).state).toEqual({ total: 0 });
  });

  it("should load an entity", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });

    const response = await server.inject({
      method: "GET",
      url: "/receipt/test",
    });

    expect(response.statusCode).toEqual(200);
    const body = JSON.parse(response.body);
    expect(body.state.total).toEqual(10);
    expect(body.aggregate).toEqual({ key: "test", type: "receipt" });
    expect(body.type).toEqual("receipt");
  });

  it("should update an entity", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });

    const response = await server.inject({
      method: "POST",
      url: "/receipt/test/add",
      payload: { amount: 5 },
    });

    expect(response.statusCode).toEqual(200);
    const body = JSON.parse(response.body);
    expect(body.state.total).toEqual(15);
  });

  it("should reject bad updates", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });

    const response = await server.inject({
      method: "POST",
      url: "/receipt/test/deduct",
      payload: { amount: 15 },
    });

    expect(response.statusCode).toEqual(500); // Server error due to insufficient funds
  });
});

describe("Server with OpenAPI", () => {
  let ms: MemoryStore;
  let server: FastifyInstance;

  // Reuse the same service description from the previous test
  const loader = LoaderDescription.fromInitFunction<Receipt>({ type: "receipt", schema: Receipt.schema }, () => ({
    total: 0,
  }))
    .reducer("added", z.object({ amount: z.number() }), (state, event) => ({
      ...state,
      total: state.total + event.data.amount,
    }))
    .reducer("deducted", z.object({ amount: z.number() }), (state, event) => ({
      ...state,
      total: state.total - event.data.amount,
    }))
    .description();

  const dispatcher = DespatcherDescription.handler("add", Commands.Add.schema, Commands.Add.handler)
    .handler("deduct", Commands.Deduct.schema, Commands.Deduct.handler)
    .description();

  const serviceDescription = ServiceDescription.create(
    { title: "receipt", description: "receipt service", version: "1.0.0" },
    loader,
    dispatcher
  );

  beforeEach(async () => {
    ms = new MemoryStore();
    const serverFactory = create(serviceDescription);
    server = await serverFactory(ms, {});
    await server.ready();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  it("should serve OpenAPI schema", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/openapi/schema.json",
    });

    expect(response.statusCode).toEqual(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);

    const schema = JSON.parse(response.body);
    expect(schema.openapi).toBe("3.1.0");
    expect(schema.info).toBeDefined();
    expect(schema.paths).toBeDefined();
    expect(schema.components).toBeDefined();

    // Check that our receipt endpoints are documented
    expect(schema.paths["/receipt/{id}"]).toBeDefined();
    expect(schema.paths["/receipt/{id}/add"]).toBeDefined();
    expect(schema.paths["/receipt/{id}/deduct"]).toBeDefined();
  });

  it("should serve documentation endpoint", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/openapi/documentation/",
    });

    expect(response.statusCode).toEqual(200);
    expect(response.headers["content-type"]).toMatch(/text\/html/);
  });

  it("should redirect /openapi to /openapi/documentation", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/openapi",
    });

    expect(response.statusCode).toEqual(302);
    expect(response.headers.location).toEqual("/openapi/documentation");
  });

  it("should work with OpenAPI disabled", async () => {
    const serverFactory = create(serviceDescription, { openAPI: false });
    const noAPIServer = await serverFactory(ms, {});
    await noAPIServer.ready();

    try {
      // Should still serve normal endpoints
      const entityResponse = await noAPIServer.inject({
        method: "GET",
        url: "/receipt/test",
      });
      expect(entityResponse.statusCode).toEqual(200);

      // Should not serve OpenAPI endpoints
      const apiResponse = await noAPIServer.inject({
        method: "GET",
        url: "/openapi/schema.json",
      });
      expect(apiResponse.statusCode).toEqual(404);

      const docsResponse = await noAPIServer.inject({
        method: "GET",
        url: "/openapi",
      });
      expect(docsResponse.statusCode).toEqual(404);
    } finally {
      await noAPIServer.close();
    }
  });
});
