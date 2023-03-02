import { DateTime } from "luxon";
import { monotonicFactory } from "ulid";

import { AggregateId, DomainEvent, RecordedEvent, Revision } from "../types";
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
    if (e.length == 0) {
      return revision;
    }

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

    const updated = current.concat(...recorded);
    this.aggregates[AggregateId.encode(aggregate)] = updated;

    return updated[updated.length - 1].revision;
  }
}
