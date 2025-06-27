import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";

import { MemoryStore } from "../store";
import { DomainEvent, Entity } from "../types";
import { DispatcherDescription, Publisher } from "./dispatcher";
import { LoaderDescription, Reducer } from "./loader";
import { ServiceDescription } from "./service";

namespace Calculator {
  export const schema = z.object({
    total: z.number(),
  });
}
type Calculator = z.infer<typeof Calculator.schema>;

namespace Commands {
  export namespace Add {
    export const schema = z.object({
      amount: z.number(),
    });
    export const create = (amount: number): Add => schema.parse({ amount });

    export const handler = async (environment: Publisher, entity: Entity<Calculator>, command: Add) => {
      const { publish } = environment;
      if (command.amount != 0) {
        await publish(entity.aggregate, { type: "added", data: { amount: command.amount } });
      }
    };
  }
  export type Add = z.infer<typeof Add.schema>;

  export namespace Subtract {
    export const schema = z.object({
      amount: z.number(),
    });

    export const create = (amount: number): Subtract => schema.parse({ amount });

    export const handler = async (environment: Publisher, entity: Entity<Calculator>, command: Subtract) => {
      const { publish } = environment;

      if (command.amount != 0) {
        await publish(entity.aggregate, { type: "subtracted", data: { amount: command.amount } });
      }
    };
  }

  export type Subtract = z.infer<typeof Subtract.schema>;

  export namespace Clear {
    export const schema = z.object({});

    export const create = (): Clear => schema.parse({});

    export const handler = async (environment: Publisher, entity: Entity<Calculator>, _: Clear) => {
      const { publish } = environment;

      if (entity.state.total != 0) {
        await publish(entity.aggregate, { type: "cleared", data: {} });
      }
    };
  }
  type Clear = z.infer<typeof Clear.schema>;
}

namespace Events {
  export namespace Added {
    export const schema = DomainEvent.schema("added", z.object({ amount: z.number() }));

    export const create = (amount: number): Added => schema.parse({ type: "added", data: { amount } });

    export const reducer: Reducer<Calculator, Added> = (state, event) => {
      return { ...state, total: state.total + event.data.amount };
    };
  }
  export type Added = z.infer<typeof Added.schema>;

  export namespace Subtracted {
    export const schema = DomainEvent.schema("subtracted", z.object({ amount: z.number() }));
    export const create = (amount: number): Subtracted => schema.parse({ type: "subtracted", data: { amount } });
    export const reducer: Reducer<Calculator, Subtracted> = (state, event) => {
      return { ...state, total: state.total - event.data.amount };
    };
  }
  export type Subtracted = z.infer<typeof Subtracted.schema>;

  export namespace Cleared {
    export const schema = DomainEvent.schema("cleared", z.object({ amount: z.number() }));
    export const create = (amount: number): Cleared => schema.parse({ type: "cleared", data: { amount } });
    export const reducer: Reducer<Calculator, Cleared> = (state) => {
      return { ...state, total: 0 };
    };
  }
  export type Cleared = z.infer<typeof Cleared.schema>;
}

describe("entity service", () => {
  const store = new MemoryStore();
  const aggregate = { type: "test", key: "1" };

  const loader = LoaderDescription.fromInitFunction<Calculator>(
    { type: "calculator", schema: Calculator.schema },
    () => ({
      total: 0,
    })
  )
    .reducer("added", Events.Added.schema.shape.data, Events.Added.reducer)
    .reducer("subtracted", Events.Subtracted.schema.shape.data, Events.Subtracted.reducer)
    .reducer("cleared", Events.Cleared.schema.shape.data, Events.Cleared.reducer)
    .description();

  const dispatcher = DispatcherDescription.handler("add", Commands.Add.schema, Commands.Add.handler)
    .handler("subtract", Commands.Subtract.schema, Commands.Subtract.handler)
    .handler("clear", Commands.Clear.schema, Commands.Clear.handler)
    .description();

  const description = ServiceDescription.create(
    { title: "test", description: "test service", version: "1.0.0" },
    loader,
    dispatcher
  );

  const service = description.service(store, {});

  beforeEach(() => {
    store.clear();
  });

  it("should load an empty entity from the store", async () => {
    const entity = await service.load(aggregate);

    expect(entity.state).toEqual({ total: 0 });
    expect(entity).toMatchSnapshot();
  });

  it("should load an entity with existing state", async () => {
    store.publish(aggregate, Events.Added.create(10));
    store.publish(aggregate, Events.Subtracted.create(3));
    const entity = await service.load(aggregate);

    expect(entity.state).toEqual({ total: 7 });
  });

  it("should return an updated value when a command is executed", async () => {
    const entity = await service.execute("add", aggregate, Commands.Add.create(10));
    expect(entity.state).toEqual({ total: 10 });
  });

  it("should maintain state between command executions", async () => {
    let entity = await service.execute("add", aggregate, Commands.Add.create(10));
    expect(entity.state).toEqual({ total: 10 });

    entity = await service.execute("subtract", aggregate, Commands.Subtract.create(7));
    expect(entity.state).toEqual({ total: 3 });

    entity = await service.execute("clear", aggregate, Commands.Clear.create());
    expect(entity.state).toEqual({ total: 0 });

    const result = await store.load(aggregate);

    expect(result).toHaveLength(3);
  });
});