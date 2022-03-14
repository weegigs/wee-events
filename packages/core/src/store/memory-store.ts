import { DateTime } from "luxon";
import { monotonicFactory } from "ulid";

import { DomainEvent, RecordedEvent, Revision, AggregateId } from "../types";
import { EventStore } from "./types";

const ulid = monotonicFactory();

export class MemoryStore implements EventStore {
  aggregates: Record<string, RecordedEvent[]> = {};

  clear() {
    this.aggregates = {};
  }

  async load(aggregate: AggregateId): Promise<RecordedEvent[]> {
    return this.aggregates[AggregateId.encode(aggregate)] ?? [];
  }

  async publish(aggregate: AggregateId, events: DomainEvent | DomainEvent[]): Promise<Revision> {
    const current = this.aggregates[AggregateId.encode(aggregate)] ?? [];
    const revision = current[current.length - 1]?.revision ?? Revision.Initial;

    const e = Array.isArray(events) ? events : [events];

    const recorded: RecordedEvent[] = e.map((event) => {
      return {
        ...event,
        id: ulid(),
        revision: ulid(),
        aggregate: aggregate,
        timestamp: DateTime.now().toISO(),
        metadata: {},
      };
    });

    this.aggregates[AggregateId.encode(aggregate)] = current.concat(...recorded);

    return revision;
  }
}
