import _ from "lodash";

import * as T from "@effect-ts/core/Effect";
import { pipe } from "@effect-ts/core/Function";

import * as wee from "@weegigs/events-core";

import * as dispatcher from "./dispatcher";
// import * as loader from "./loader";
import * as store from "../event-store";

import * as receipts from "./sample/receipts";

const id = { key: "test", type: "receipt" };
const ms = new wee.MemoryStore();

describe("describe receipt service", () => {
  beforeEach(() => ms.clear());

  it("should load an empty entity", async () => {
    const program = pipe(receipts.service.load(id), T.provideService(store.EventLoader)(ms));

    const result = await T.runPromise(program);

    expect(result.state.total).toEqual(0);
    expect(result.revision).toEqual(wee.Revision.Initial);
    expect(result).toMatchSnapshot();
  });

  it.skip("should load an empty entity if the aggregate only contains unknown events", async () => {
    ms.publish(id, { type: "unknown", data: { value: "something" } });

    const program = pipe(receipts.service.load(id), T.provideService(store.EventLoader)(ms));
    const result = await T.runPromise(program);

    expect(result.state.total).toEqual(0);
    expect(result.revision).toEqual(wee.Revision.Initial);
    expect(result).toMatchSnapshot();
  });

  it("should load an entity with existing events", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });

    const program = pipe(receipts.service.load(id), T.provideService(store.EventLoader)(ms));
    const result = await T.runPromise(program);

    expect(result.state.total).toEqual(10);
    expect(result.revision).not.toEqual(wee.Revision.Initial);
    expect(_.omit(result, "revision")).toMatchSnapshot();
  });

  it("should skip unknown event types", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });
    ms.publish(id, { type: "unknown", data: { value: "something" } });

    const program = pipe(receipts.service.load(id), T.provideService(store.EventLoader)(ms));
    const result = await T.runPromise(program);

    expect(result.state.total).toEqual(10);
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

    expect(result.state.total).toEqual(15);
    expect(result.revision).not.toEqual(wee.Revision.Initial);
    expect(_.omit(result, "revision")).toMatchSnapshot();
  });

  it("should create an entity", async () => {
    const update = receipts.service.execute("add", id, { amount: 5 });

    const program = pipe(update, T.provideService(store.EventLoader)(ms), T.provideService(store.EventPublisher)(ms));
    const result = await T.runPromise(program);

    expect(result.state.total).toEqual(5);
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
