import _ from "lodash";

import { ServiceDescription } from "@weegigs/events-core";
import { MemoryStore } from "@weegigs/events-core/lib/store/memory-store";

import { create } from "./server";

describe("fastify server", () => {
  const id = { key: "test", type: "receipt" };
  const ms = new MemoryStore();


  const service = ServiceDescription.create({


  const server: FastifyInstance = create()(ms, {});

  beforeEach(() => ms.clear());

  afterAll(async () => {
    await server.close();
  });

  it("should create a server from a service description", async () => {
    expect(server).toBeDefined();
  });

  it("should return a 404 if the entity is not found", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/receipt/missing",
    });

    expect(response).toBeDefined();
    expect(response.statusCode).toEqual(404);
    expect(JSON.parse(response.body)).toMatchSnapshot();
  });

  it("should load an entity", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });

    const response = await server.inject({
      method: "GET",
      url: "/receipt/test",
    });

    expect(response.statusCode).toEqual(200);
    expect(_.omit(JSON.parse(response.body), "$revision")).toMatchSnapshot();
  });

  it("should update an entity", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });

    const response = await server.inject({
      method: "POST",
      url: "/receipt/test/add",
      payload: { amount: 5 },
    });

    expect(response.statusCode).toEqual(200);
    expect(_.omit(JSON.parse(response.body), "$revision")).toMatchSnapshot();
  });

  it("should reject bad updates", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });

    const response = await server.inject({
      method: "POST",
      url: "/receipt/test/deduct",
      payload: { amount: 15 },
    });

    expect(response.statusCode).toEqual(400);
    expect(_.omit(JSON.parse(response.body), "$revision")).toMatchSnapshot();
  });
});
