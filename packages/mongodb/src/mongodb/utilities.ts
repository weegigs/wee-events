import * as _ from "lodash";

import { SourceEvent } from "@weegigs/events-core";

import { Collection, IndexOptions } from "mongodb";

export async function createIndex(
  name: string,
  fields: Record<string, 1 | -1>,
  options: IndexOptions,
  collection: Collection
) {
  if (!await collection.indexExists(name)) {
    await collection.createIndex(fields, { ...options, name });
  }
}

export function createEventFilter<E extends SourceEvent = any>(
  events?: string | string[]
): (event: E) => boolean {
  const types = events !== undefined ? (_.isArray(events) ? events : [events]) : undefined;
  return (event: E) => types === undefined || _.includes(types, event.type);
}
