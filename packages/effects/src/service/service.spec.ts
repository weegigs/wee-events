import _ from "lodash";

import * as T from "@effect-ts/core/Effect";
import { pipe } from "@effect-ts/core/Function";

import * as wee from "@weegigs/events-core";

import * as dispatcher from "./dispatcher";
import * as loader from "./loader";
import * as store from "../event-store";

import * as receipts from "./sample/receipts";

const id = { key: "test", type: "receipt" };
const ms = new wee.MemoryStore();

describe("describe receipt service", () => {
  beforeEach(() => ms.clear());

  it("should fail if entity can't be created", async () => {
    const program = pipe(receipts.service.load(id), T.provideService(store.EventLoader)(ms));

    expect(T.runPromise(program)).rejects.toBeInstanceOf(loader.EntityNotAvailableError);
  });

  it("should load an entity", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });

    const program = pipe(receipts.service.load(id), T.provideService(store.EventLoader)(ms));
    const result = await T.runPromise(program);

    expect(result.state).toEqual({ total: 10 });
    expect(result.revision).not.toEqual(wee.Revision.Initial);
    expect(_.omit(result, "revision")).toMatchSnapshot();
  });

  it("should reject unknown paths", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });

    const update = receipts.service.execute("add/it", id, { amount: 5 });

    const program = pipe(update, T.provideService(store.EventLoader)(ms), T.provideService(store.EventPublisher)(ms));
    expect(T.runPromise(program)).rejects.toBeInstanceOf(dispatcher.HandlerNotFound);
  });

  it("should validate command structure", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });

    const update = receipts.service.execute("add", id, { value: 5 });

    const program = pipe(update, T.provideService(store.EventLoader)(ms), T.provideService(store.EventPublisher)(ms));
    expect(T.runPromise(program)).rejects.toBeInstanceOf(dispatcher.CommandValidationError);
  });

  it("should update an entity", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });

    const update = receipts.service.execute("add", id, { amount: 5 });

    const program = pipe(update, T.provideService(store.EventLoader)(ms), T.provideService(store.EventPublisher)(ms));
    const result = await T.runPromise(program);

    expect(result.state).toEqual({ total: 15 });
    expect(result.revision).not.toEqual(wee.Revision.Initial);
    expect(_.omit(result, "revision")).toMatchSnapshot();
  });

  it("should propagate handler errors", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });

    const update = receipts.service.execute("deduct", id, { amount: 15 });

    const program = pipe(update, T.provideService(store.EventLoader)(ms), T.provideService(store.EventPublisher)(ms));

    expect(T.runPromise(program)).rejects.toBeInstanceOf(receipts.InsufficientBalanceError);
  });
});
