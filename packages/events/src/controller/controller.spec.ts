/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { DomainEvent } from "../types";
import { MemoryStore } from "../store";

import { Events, ExampleController, Commands } from "./example";
import { Controller } from "./controller";

describe("Entity Service", () => {
  let entries: string[] = [];

  const store = new MemoryStore();
  const log = (message: string) => entries.push(message);

  const service = Controller.service(new ExampleController(log), { store });

  const events: DomainEvent[] = [
    {
      type: Events.Incremented,
      data: {
        count: 1,
      },
    },
    {
      type: Events.Started,
      data: {},
    },
    {
      type: Events.Incremented,
      data: {
        count: 6,
      },
    },
    {
      type: Events.Incremented,
      data: {
        count: 5,
      },
    },
  ];

  const aggregate = { type: "example", key: "1" };

  beforeEach(() => {
    store.clear();
    entries = [];
  });

  it("should load hydrated state", async () => {
    await store.publish(aggregate, events);

    const { state } = (await service.load(aggregate))!;

    expect(state.total).toEqual(11);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual("increment event received but the counter is not running. ignoring");
  });

  it("should execute commands", async () => {
    await service.execute(aggregate, { name: Commands.Start, data: {} });
    const { state } = (await service.execute(aggregate, { name: Commands.Increment, data: { count: 1 } }))!;

    expect(state.total).toEqual(1);
  });
});
