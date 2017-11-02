import { Observable } from "rxjs";

import { EventId, Event, PublishedEvent } from "../types";
import { AggregateId } from "../aggregate";

export interface EventListenerOptions {
  after?: EventId;
}

export interface SnapshotOptions {
  after?: EventId;
}

export interface EventStore {
  publish(events: Event | Event[]): Promise<PublishedEvent[]>;
  stream(options?: EventListenerOptions): Observable<PublishedEvent>;
  snapshot(aggregateId: AggregateId, options?: SnapshotOptions): Promise<PublishedEvent[]>;
}

export type EventListener = (event: PublishedEvent) => Promise<void>;
