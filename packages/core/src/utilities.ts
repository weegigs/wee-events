import * as R from "ramda";
import { PublishedEvent } from "./types";

export function timeout<T>(duration: number, action: Promise<T>): Promise<"timeout" | T> {
  const timer = new Promise<"timeout">((resolve, reject) => {
    setTimeout(() => {
      resolve("timeout");
    }, duration);
  });

  return Promise.race([timer, action]);
}

export function latest(events: PublishedEvent[], sorted: boolean = false): PublishedEvent | undefined {
  return sorted && events.length > 0
    ? R.last(events) as PublishedEvent
    : events.reduce<PublishedEvent | undefined>((result, event) => {
        return result === undefined || result.id < event.id ? event : result;
      }, undefined);
}
