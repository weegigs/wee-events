import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";

import { EventStore } from "../store";
import { AggregateId, DomainEvent, Entity, Revision } from "../types";
import { CommandValidationError, DispatcherDescription, HandlerNotFound, Publisher } from "./dispatcher";

const withLogger = <R extends Publisher>(environment: R): R & { logger: (message: string) => void } => {
  const logger = (message: string) => {
    console.log(message);
  };

  return Object.assign({}, environment, { logger });
};

type Logger = { logger: (message: string) => void };

type Count = {
  current: number;
};

type Add = {
  amount: number;
};

namespace Add {
  export const schema = z.object({
    amount: z.number(),
  });
}

const add = async (environment: Publisher, entity: Entity<Count>, command: Add) => {
  const { publish } = environment;

  if (command.amount != 0) {
    await publish(entity.aggregate, { type: "added", data: { amount: command.amount } });
  }
};

type Subtract = {
  amount: number;
};

namespace Subtract {
  export const schema = Add.schema;
}

const subtract = async (environment: Publisher, entity: Entity<Count>, command: Subtract) => {
  const { publish } = environment;

  if (command.amount != 0) {
    await publish(entity.aggregate, { type: "subtracted", data: { amount: -command.amount } });
  }
};

type Clear = Record<string, never>;

namespace Clear {
  export const schema = z.object({});
}

const clear = async (environment: Logger & Publisher, entity: Entity<Count>, _: Clear) => {
  const { publish, logger } = environment;

  if (entity.state.current != 0) {
    logger(`Clearing ${entity.aggregate.key}`);
    await publish(entity.aggregate, { type: "cleared", data: {} });
  }
};

describe("dispatcher", () => {
  let events: Record<string, DomainEvent[]> = {};

  beforeEach(() => {
    events = {};
  });

  const publish: EventStore.Publisher = async (aggregate: AggregateId, event: DomainEvent) => {
    const id = AggregateId.encode(aggregate);
    const _events = events[id] || [];
    events[id] = [..._events, event];

    return "";
  };

  const environment = withLogger({ publish });

  const target = Entity.create(AggregateId.create("counter", "1"), "counter", Revision.Initial, { current: 0 });

  it("should allow a dispatcher to be created with a single handler", async () => {
    const dispatcher = DispatcherDescription.handler("add", Add.schema, add).description().dispatcher(environment);

    await dispatcher.dispatch("add", target, { amount: 1 });

    expect(events[AggregateId.encode(target.aggregate)]).toHaveLength(1);
    expect(events).toMatchSnapshot();
  });

  it("should allow a dispatcher to be created with multiple handlers", async () => {
    const dispatcher = DispatcherDescription.handler("add", Add.schema, add)
      .handler("subtract", Subtract.schema, subtract)
      .handler("clear", Clear.schema, clear)
      .description()
      .dispatcher(environment);

    await dispatcher.dispatch("add", target, { amount: 1 });
    await dispatcher.dispatch("subtract", target, { amount: 2 });

    expect(events[AggregateId.encode(target.aggregate)]).toHaveLength(2);
    expect(events).toMatchSnapshot();
  });

  it("should fail with a handler not found error if a command is sent to an unknown path", async () => {
    const dispatcher = DispatcherDescription.handler("add", Add.schema, add).description().dispatcher(environment);

    await expect(dispatcher.dispatch("multiply", target, { amount: 1 })).rejects.toThrowError(HandlerNotFound);
  });

  it("should fail with a validation error if a command payload is incorrect", async () => {
    const dispatcher = DispatcherDescription.handler("add", Add.schema, add).description().dispatcher(environment);

    await expect(dispatcher.dispatch("add", target, { quantity: 1 })).rejects.toThrowError(CommandValidationError);
  });

  it("should allow describe the paths and commands available", async () => {
    const description = DispatcherDescription.handler("add", Add.schema, add)
      .handler("subtract", Subtract.schema, subtract)
      .handler("clear", Clear.schema, clear)
      .description();

    expect(Object.keys(description.commands())).toHaveLength(3);
    expect(Object.keys(description.commands()).sort()).toEqual("add,clear,subtract".split(","));
  });
});