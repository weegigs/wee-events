import {
  SourceEvent,
  PublishedEvent,
  ProjectionFunction,
  serialize,
  eventId,
} from "@weegigs/events-core";
import { Collection } from "mongodb";
import { Subscription } from "rxjs";

import { MongoEventStore } from "../event-store";
import { config } from "../config";
import { createEventFilter } from "../utilities";

import { ListenerMetadata, ListenerOptions } from "./types";

async function metadataFor(name: string, collection: Collection): Promise<ListenerMetadata> {
  const document = await collection.findOne({ _id: name });
  return document === null ? { name } : document;
}

async function position(name: string, collection: Collection) {
  const { position } = await metadataFor(name, collection);
  return position;
}

async function updatePosition(name: string, collection: Collection, position: string) {
  return collection.updateOne({ _id: name }, { $set: { name, position } }, { upsert: true });
}

function createProjection<E extends SourceEvent = any>(
  name: string,
  collection: Collection,
  options: ListenerOptions
): ProjectionFunction<E> {
  const projection = options.projection;

  return (event: PublishedEvent<E>) => {
    return serialize(async (event: PublishedEvent<E>) => {
      await projection(event);
      await updatePosition(name, collection, eventId(event));
    })(event);
  };
}

export async function attachListener(
  store: MongoEventStore,
  collection: Collection,
  options: ListenerOptions
): Promise<Subscription> {
  const { name, events } = options;

  const after = await position(name, collection);
  const streamOptions = { after };

  const filter = createEventFilter(events);
  const projection = createProjection(name, collection, options);

  return store
    .stream(streamOptions)
    .filter(filter)
    .subscribe(
      event => projection(event),
      error => {
        config.logger.error(`${name}: Event stream error`, error);
      },
      () => {
        config.logger.info(`${name}: Event stream completed`);
      }
    ) as any;
}
