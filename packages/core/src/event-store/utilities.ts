import * as moment from "moment";
import * as R from "ramda";

import { Observable, Subscription } from "rxjs";
import { monotonicFactory, decodeTime } from "ulid";

import { Event, PublishedEvent } from "../types";
import { EventStore, EventListenerOptions, EventListener } from "../event-store";

const ulid = monotonicFactory();

export function stampEvent(source: Event | Event[]): PublishedEvent[] {
  const now = moment.utc();
  const timestamp = now.valueOf();
  const publishedAt = now.toDate();

  const events = Array.isArray(source) ? source : [source];

  return events.map((event: Event, index) => {
    const published: PublishedEvent = {
      ...event,
      id: ulid(timestamp),
      publishedAt,
    };

    const key = (event as any).key || event.id;
    return R.isNil(key) ? published : { ...published, key };
  });
}

export function eventTimestamp(event: PublishedEvent): number {
  return decodeTime(event.id);
}

const FLUSH_INTERVAL = 15 * 60 * 1000; // 15 minutes
export function subscribe(
  store: EventStore,
  subscriber: EventListener,
  options: EventListenerOptions = {}
): Subscription {
  return store
    .stream(options)
    .distinct((e: any) => e.jey || e.id, Observable.timer(FLUSH_INTERVAL, FLUSH_INTERVAL))
    .subscribe(subscriber);
}
