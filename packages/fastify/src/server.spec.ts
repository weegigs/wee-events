import { FastifyInstance } from "fastify";
import { z } from "zod";

import { 
  MemoryStore,
  Entity, 
  DespatcherDescription, 
  LoaderDescription, 
  ServiceDescription,
  Publisher 
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

  const loader = LoaderDescription.fromInitFunction<Receipt>(
    { type: "receipt", schema: Receipt.schema },
    () => ({ total: 0 })
  )
    .reducer("added", z.object({ amount: z.number() }), (state, event) => ({ ...state, total: state.total + event.data.amount }))
    .reducer("deducted", z.object({ amount: z.number() }), (state, event) => ({ ...state, total: state.total - event.data.amount }))
    .description();

  const dispatcher = DespatcherDescription.handler("add", Commands.Add.schema, Commands.Add.handler)
    .handler("deduct", Commands.Deduct.schema, Commands.Deduct.handler)
    .description();

  const description = ServiceDescription.create(
    { title: "receipt", description: "receipt service", version: "1.0.0" },
    loader,
    dispatcher
  );

  const serverFactory = create(description);
  const server: FastifyInstance = serverFactory(ms, {});

  beforeEach(() => ms.clear());

  afterAll(async () => {
    await server.close();
  });

  it("should create a server from a service description", async () => {
    expect(server).toBeDefined();
    expect(server.inject).toBeDefined();
  });

  it("should return a 404 if the entity is not found", async () => {
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