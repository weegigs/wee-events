import * as moment from "moment";

import { Observable, Subscription } from "rxjs";
import { monotonicFactory, decodeTime } from "ulid";

import { eventId } from "../utilities";
import { SourceEvent, PublishedEvent } from "../types";
import { EventStore, EventStreamOptions, EventListener } from "../event-store";

const ulid = monotonicFactory();

export function stampEvent(source: SourceEvent<any> | SourceEvent<any>[]): PublishedEvent<any>[] {
  const now = moment.utc();
  const timestamp = now.valueOf();
  const publishedAt = now.toDate();

  const events = Array.isArray(source) ? source : [source];

  return events.map((event: SourceEvent, index) => {
    const published: PublishedEvent = {
      __publicationMetadata: {
        id: ulid(timestamp),
        publishedAt,
      },
      ...event,
    };

    return published;
  });
}

export function eventTimestamp(event: PublishedEvent): number {
  return decodeTime(eventId(event));
}

const FLUSH_INTERVAL = 15 * 60 * 1000; // 15 minutes
export function subscribe(
  store: EventStore,
  subscriber: EventListener,
  options: EventStreamOptions = {}
): Subscription {
  return store
    .stream(options)
    .distinct((e: PublishedEvent) => eventId(e), Observable.timer(FLUSH_INTERVAL, FLUSH_INTERVAL))
    .subscribe(subscriber);
}
