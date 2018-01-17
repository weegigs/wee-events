import * as R from "ramda";

import { PublishedEvent, PublicationMetadata } from "./types";

export function timeout<T>(duration: number, action: Promise<T>): Promise<"timeout" | T> {
  const timer = new Promise<"timeout">((resolve, reject) => {
    setTimeout(() => {
      resolve("timeout");
    }, duration);
  });

  return Promise.race([timer, action]);
}

export function latestEvent(events: PublishedEvent[], sorted: boolean = false): PublishedEvent | undefined {
  return sorted && events.length > 0
    ? R.last(events)
    : events.reduce<PublishedEvent | undefined>((result, event) => {
        return result === undefined || eventId(result) < eventId(event) ? event : result;
      }, undefined);
}

export function eventMetadata(event: PublishedEvent<any>): PublicationMetadata {
  return event["__publicationMetadata"];
}

export function eventId(event: PublishedEvent<any>) {
  return eventMetadata(event).id;
}

export function eventPublishedAt(event: PublishedEvent<any>) {
  return eventMetadata(event).publishedAt;
}
