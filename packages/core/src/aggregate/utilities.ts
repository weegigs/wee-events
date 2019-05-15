import * as R from "ramda";
import * as assert from "assert";

import { PublishedEvent } from "../types";
import { eventId } from "../utilities";

import { AggregateId, AggregateVersion } from "./types";
import { EventStore } from "../event-store";

export function aggregateKey(id: AggregateId): string {
  return `${id.type}:${id.id}`;
}

export function aggregateId(type: string, id: string): AggregateId {
  return { type, id };
}

const sortEvents = (events: PublishedEvent[]) => R.sortBy<PublishedEvent>(eventId, R.uniqBy(eventId, events));

export function aggregateVersionFromEvents(
  id: AggregateId,
  published: PublishedEvent[],
  current: AggregateVersion = { id, version: undefined, events: [] }
): AggregateVersion {
  assert.deepStrictEqual(id, current.id, "");

  const latest = R.last(published);
  const version = (latest && eventId(latest)) || current.version;
  const events = sortEvents(R.concat(current.events, published));
  return { id: current.id, version, events };
}

export async function loadAggregateVersion(store: EventStore, id: AggregateId): Promise<AggregateVersion> {
  let events = await store.snapshot(id);
  return aggregateVersionFromEvents(id, events);
}
