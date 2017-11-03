import { Observable } from "rxjs";

import { EventId, Event, PublishedEvent } from "../types";
import { AggregateId } from "../aggregate";

export type EventListener = (event: PublishedEvent) => Promise<void>;

export interface EventStreamOptions {
  after?: EventId;
}

export interface EventSnapshotOptions {
  after?: EventId;
}

export interface EventStore {
  publish(events: Event | Event[]): Promise<PublishedEvent[]>;
  stream(options?: EventStreamOptions): Observable<PublishedEvent>;
  snapshot(aggregateId: AggregateId, options?: EventSnapshotOptions): Promise<PublishedEvent[]>;
}
