import _ from "lodash";

import { Effect, Exit, Layer, pipe, Cause } from "effect";

import * as wee from "@weegigs/events-core";

import * as dispatcher from "./dispatcher";
import * as store from "../event-store";

import * as receipts from "./sample/receipts";

describe("describe receipt service", () => {
  const id = { key: "test", type: "receipt" };
  const ms = new wee.MemoryStore();

  beforeEach(() => ms.clear());

  it("should load an empty entity", async () => {
    const program = pipe(receipts.service.load(id), Effect.provide(Layer.succeed(store.EventLoader, ms)));

    const result = await Effect.runPromise(program);

    expect(result.state.total).toEqual(0);
    expect(result.revision).toEqual(wee.Revision.Initial);
    expect(result).toMatchSnapshot();
  });

  it("should load an empty entity if the aggregate only contains unknown events", async () => {
    ms.publish(id, { type: "unknown", data: { value: "something" } });

    const program = pipe(receipts.service.load(id), Effect.provide(Layer.succeed(store.EventLoader, ms)));
    const result = await Effect.runPromise(program);

    expect(result.state.total).toEqual(0);
    expect(result.revision).toEqual(wee.Revision.Initial);
    expect(result).toMatchSnapshot();
  });

  it("should load an entity with existing events", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });

    const program = pipe(receipts.service.load(id), Effect.provide(Layer.succeed(store.EventLoader, ms)));
    const result = await Effect.runPromise(program);

    expect(result.state.total).toEqual(10);
    expect(result.revision).not.toEqual(wee.Revision.Initial);
    expect(_.omit(result, "revision")).toMatchSnapshot();
  });

  it("should skip unknown event types", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });
    ms.publish(id, { type: "unknown", data: { value: "something" } });

    const program = pipe(receipts.service.load(id), Effect.provide(Layer.succeed(store.EventLoader, ms)));
    const result = await Effect.runPromise(program);

    expect(result.state.total).toEqual(10);
    expect(result.revision).not.toEqual(wee.Revision.Initial);
    expect(_.omit(result, "revision")).toMatchSnapshot();
  });

  it("should reject unknown paths", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });

    const update = receipts.service.execute("add/it", id, { amount: 5 });

    const program = pipe(
      update,
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(store.EventLoader, ms),
          Layer.succeed(store.EventPublisher, ms)
        )
      )
    );
    const exit = await Effect.runPromiseExit(program);
    
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      if (failure._tag === "Some") {
        expect(failure.value).toBeInstanceOf(dispatcher.HandlerNotFound);
      }
    }
  });

  it("should validate command structure", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });

    const update = receipts.service.execute("add", id, { value: 5 });

    const program = pipe(
      update,
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(store.EventLoader, ms),
          Layer.succeed(store.EventPublisher, ms)
        )
      )
    );
    const exit = await Effect.runPromiseExit(program);
    
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      if (failure._tag === "Some") {
        expect(failure.value).toBeInstanceOf(dispatcher.CommandValidationError);
      }
    }
  });

  it("should update an entity", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });

    const update = receipts.service.execute("add", id, { amount: 5 });

    const program = pipe(
      update,
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(store.EventLoader, ms),
          Layer.succeed(store.EventPublisher, ms)
        )
      )
    );
    const result = await Effect.runPromise(program);

    expect(result.state.total).toEqual(15);
    expect(result.revision).not.toEqual(wee.Revision.Initial);
    expect(_.omit(result, "revision")).toMatchSnapshot();
  });

  it("should create an entity", async () => {
    const update = receipts.service.execute("add", id, { amount: 5 });

    const program = pipe(
      update,
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(store.EventLoader, ms),
          Layer.succeed(store.EventPublisher, ms)
        )
      )
    );
    const result = await Effect.runPromise(program);

    expect(result.state.total).toEqual(5);
    expect(result.revision).not.toEqual(wee.Revision.Initial);
    expect(_.omit(result, "revision")).toMatchSnapshot();
  });

  it("should propagate handler errors", async () => {
    ms.publish(id, { type: "added", data: { amount: 10 } });

    const update = receipts.service.execute("deduct", id, { amount: 15 });
    const program = pipe(
      update,
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(store.EventLoader, ms),
          Layer.succeed(store.EventPublisher, ms)
        )
      )
    );

    const exit = await Effect.runPromiseExit(program);
    
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      if (failure._tag === "Some") {
        expect(failure.value).toBeInstanceOf(receipts.InsufficientBalanceError);
      }
    }
  });
});
