import * as R from "ramda";

import { ReplaySubject, Observable } from "rxjs";
import { filter } from "rxjs/operators";

import { eventId } from "../utilities";
import { SourceEvent, PublishedEvent } from "../types";
import { AggregateId } from "../aggregate";

import { EventStore, EventStreamOptions, EventSnapshotOptions } from "./types";
import { stampEvent } from "./utilities";

export class MemoryEventStore implements EventStore {
  private updates: ReplaySubject<PublishedEvent>;
  private events: PublishedEvent[] = [];

  constructor() {
    this.updates = new ReplaySubject<PublishedEvent>();
  }

  async publish(events: SourceEvent[] | SourceEvent): Promise<PublishedEvent[]> {
    const published = stampEvent(events);

    this.events = this.events.concat(published);
    published.forEach(e => this.updates.next(e));

    return published;
  }

  async snapshot(aggregateId: AggregateId, options: EventSnapshotOptions = {}): Promise<PublishedEvent[]> {
    const { after } = options;

    const events = this.events.filter(e => R.equals(e.aggregateId, aggregateId));
    return after ? events.filter(e => eventId(e) > after) : events;
  }

  stream(options: EventStreamOptions = {}): Observable<PublishedEvent> {
    let observable = this.updates.asObservable();
    const { after } = options;

    if (after) {
      observable = observable.pipe(filter(e => eventId(e) > after));
    }

    return observable as any;
  }
}
