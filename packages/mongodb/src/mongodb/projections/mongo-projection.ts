import * as _ from "lodash";

import { PublishedEvent, EventStore, ProjectionFunction, serialize } from "@weegigs/events-core";
import { Collection } from "mongodb";
import { Subscription } from "rxjs";

import { DocumentProjectionFunction, DocumentProjectionOptions } from "../types";
import { config } from "../config";

import { MongoProjectionCollection } from "./mongo-projection-collection";
import { ProjectionDocument, ProjectionMetadata } from "./types";

async function projectionMetadata(
  name: string,
  collection: Collection<ProjectionMetadata>
): Promise<ProjectionMetadata> {
  const document = await collection.findOne({ name });
  return document === null ? { name, position: undefined } : document;
}

async function position(name: string, collection: Collection) {
  const { position } = await projectionMetadata(name, collection);
  return position;
}

async function updatePosition(name: string, collection: Collection, position: string) {
  return collection.updateOne({ name }, { name, position }, { upsert: true });
}

function project<T>(
  collection: MongoProjectionCollection<T>,
  projection: DocumentProjectionFunction<T>,
  options: DocumentProjectionOptions = {}
) {
  const { merge, type, preload, remove } = {
    merge: true,
    preload: false,
    remove: false,
    ...options,
  } as DocumentProjectionOptions;

  return async (event: PublishedEvent): Promise<void> => {
    const { aggregateId: id } = event;
    if (type === undefined || type === id.type) {
      const current = preload || merge ? await collection.fetch(id) : undefined;
      const data = await projection(event, current);
      if (data) {
        const content = merge === true ? _.merge(current, data) : data;
        await collection.updateProjection(event, content);
      } else if (remove === true) {
        await collection.deleteProjection(event.aggregateId);
      }
    }
  };
}

function create<T>(
  collection: Collection<ProjectionDocument<T>>,
  projection: DocumentProjectionFunction<T>,
  options?: DocumentProjectionOptions
): ProjectionFunction<T> {
  const projectCollection = new MongoProjectionCollection<T>(collection);

  const process = project<T>(projectCollection, projection, options);

  return (event: PublishedEvent<T>) => {
    return serialize(async (event: PublishedEvent<T>) => {
      await process(event);
      await updatePosition(name, collection, event.id);
    })(event);
  };
}

export async function attach<T>(
  store: EventStore,
  name: string,
  collection: Collection<ProjectionDocument<T>>,
  projection: DocumentProjectionFunction<T>,
  options: DocumentProjectionOptions = {}
): Promise<Subscription> {
  const after = await position(name, collection);
  const subscriptionOptions = { after, ...options };
  const mongoProjection = create(collection, projection, subscriptionOptions);

  return store.stream(subscriptionOptions).subscribe(
    event => mongoProjection(event),
    error => {
      config.logger.error("event stream error", error);
    },
    () => {
      config.logger.info("event stream completed");
    }
  ) as any;
}
