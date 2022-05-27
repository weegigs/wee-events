import _ from "lodash";
import * as T from "@effect-ts/core/Effect";

import { create } from "./server";
import { description, InsufficientBalanceError } from "@weegigs/effects/lib/service/sample/receipts";
import { pipe } from "@effect-ts/core/Function";
import { MemoryStore } from "@weegigs/events-core/lib/store/memory-store";
import { EventLoader, EventPublisher } from "@weegigs/effects/lib/event-store";
import { FastifyInstance } from "fastify";
import * as errors from "http-errors";
import { ExpectedRevisionConflictError, RevisionConflictError } from "@weegigs/events-core";

describe("fastify server", () => {
  const id = { key: "test", type: "receipt" };
  const ms = new MemoryStore();
  const el = T.provideService(EventLoader)(ms);
  const pu = T.provideService(EventPublisher)(ms)
  const app = create(description, (e) => {
    switch (e.constructor) {
      case InsufficientBalanceError:
        return new errors.BadRequest(e.message)
    
      case ExpectedRevisionConflictError:
      case RevisionConflictError:
        return new errors.Conflict(e.message)        

      default:
        return new errors.InternalServerError(e.message)
    }
  });
  const program = pipe(app, el, pu);

  let server: FastifyInstance

  beforeEach(() => ms.clear())
  beforeAll(async () => {
    server = await T.runPromise(program);
  })
  afterAll(async () => {
    await server.close()
  })

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
      payload: { amount: 5 }
    });

    expect(response.statusCode).toEqual(200);
    expect(_.omit(JSON.parse(response.body), "$revision")).toMatchSnapshot();
  });

  it("should reject bad updates", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });

    const response = await server.inject({
      method: "POST",
      url: "/receipt/test/deduct",
      payload: { amount: 15 }
    });

    expect(response.statusCode).toEqual(400);
    expect(_.omit(JSON.parse(response.body), "$revision")).toMatchSnapshot();
  });

});
