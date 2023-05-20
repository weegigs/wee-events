import { DateTime } from "luxon";
import { decodeTime, monotonicFactory } from "ulid";
import { z } from "zod";

import { EventStore } from "../store";
import { DomainEvent, RecordedEvent, Revision } from "../types";
import { EntityNotAvailableError, Initializer, LoaderDescription, Reducer } from "./loader";

const ulid = monotonicFactory();

namespace Calculator {
  export const schema = z.object({
    total: z.number(),
  });
}
type Calculator = z.infer<typeof Calculator.schema>;

type Added = DomainEvent<"added", { amount: number }>;
namespace Added {
  export const schema = z.object({ amount: z.number() });
}

const addr: Reducer<Calculator, Added> = (state, event) => {
  return { ...state, total: state.total + event.data.amount };
};

const addi: Initializer<Calculator, Added> = (event) => {
  return { total: event.data.amount };
};

type Subtracted = DomainEvent<"subtracted", { amount: number }>;
namespace Subtracted {
  export const schema = z.object({ amount: z.number() });

  export const reducer: Reducer<Calculator, Subtracted> = (state, event) => ({
    ...state,
    total: state.total - event.data.amount,
  });

  export const initializer: Initializer<Calculator, Subtracted> = (event) => ({ total: -event.data.amount });
}

describe("loaders", () => {
  const load = jest.fn();

  const store: EventStore = {
    publish: jest.fn(),
    load,
  };

  const tid = { type: "test", key: "1" };
  const added = (amount: number): RecordedEvent<Added> => {
    const id = ulid();
    const timestamp = DateTime.fromMillis(decodeTime(id)).toISO()!;

    return {
      id,
      aggregate: tid,
      revision: id,
      type: "added",
      data: { amount },
      timestamp,
      metadata: {},
    };
  };
  const subtracted = (amount: number): RecordedEvent<Subtracted> => {
    const id = ulid();
    const timestamp = DateTime.fromMillis(decodeTime(id)).toISO()!;

    return {
      id,
      aggregate: tid,
      revision: id,
      type: "subtracted",
      data: { amount },
      timestamp,
      metadata: {},
    };
  };

  describe("with init function", () => {
    const description = LoaderDescription.fromInitFunction<Calculator>(
      { type: "calculator", schema: Calculator.schema },
      () => ({ total: 0 })
    )
      .reducer("added", Added.schema, addr)
      .description();

    const loader = description.create(store);

    it("should return an initialized entity if no events are available", async () => {
      load.mockResolvedValueOnce([]);

      const result = await loader.load(tid);

      expect(result.state).toEqual({ total: 0 });
      expect(result).toMatchSnapshot();
    });

    it("should return a upto date entity if events are available", async () => {
      load.mockResolvedValueOnce([added(1), added(2), added(3)]);

      const result = await loader.load(tid);

      expect(result.state).toEqual({ total: 6 });
      expect(result.revision).not.toEqual(Revision.Initial);
    });

    it("should provide a description of the events handled", () => {
      const events = description.events();

      expect(Object.keys(events)).toHaveLength(1);
      expect(events["added"]).toBeDefined();
    });
  });

  describe("with initializer", () => {
    const description = LoaderDescription.fromInitializer(
      { type: "calculator", schema: Calculator.schema },
      "added",
      Added.schema,
      addi
    )
      .initializer("subtracted", Subtracted.schema, Subtracted.initializer)
      .reducer("added", Added.schema, addr)
      .reducer("subtracted", Subtracted.schema, Subtracted.reducer)
      .description();

    const loader = description.create(store);

    it("should throw an EntityNotAvailable error if no events are available", async () => {
      load.mockResolvedValueOnce([]);

      await expect(loader.load(tid)).rejects.toThrowError(EntityNotAvailableError);
    });

    it("should return a upto date entity if events are available", async () => {
      load.mockResolvedValueOnce([added(1), subtracted(2), added(3)]);

      const result = await loader.load(tid);

      expect(result.state).toEqual({ total: 2 });
      expect(result.revision).not.toEqual(Revision.Initial);
    });

    it("should handle alternative initializers", async () => {
      load.mockResolvedValueOnce([subtracted(3), added(2), added(3)]);

      const result = await loader.load(tid);

      expect(result.state).toEqual({ total: 2 });
      expect(result.revision).not.toEqual(Revision.Initial);
    });

    it("should provide a description of the events handled", () => {
      const events = description.events();

      expect(Object.keys(events)).toHaveLength(2);
      expect(events["added"]).toBeDefined();
      expect(events["subtracted"]).toBeDefined();
    });
  });
});
