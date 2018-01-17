import { Observable } from "rxjs";

import { EventId, SourceEvent, PublishedEvent } from "../types";
import { AggregateId } from "../aggregate";

export type EventListener = <E extends SourceEvent = any>(event: PublishedEvent<E>) => Promise<void>;

export interface EventStreamOptions {
  after?: EventId;
}

export interface EventSnapshotOptions {
  after?: EventId;
}

export interface EventStore {
  publish(events: SourceEvent<any> | SourceEvent<any>[]): Promise<PublishedEvent<any>[]>;
  stream(options?: EventStreamOptions): Observable<PublishedEvent<any>>;
  snapshot(aggregateId: AggregateId, options?: EventSnapshotOptions): Promise<PublishedEvent<any>[]>;
}
