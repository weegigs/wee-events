import * as _ from "lodash";

import { PublishedEvent, ProjectionFunction, serialize } from "@weegigs/events-core";
import { Collection } from "mongodb";
import { Subscription } from "rxjs";

import { MongoEventStore } from "../";
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
  return collection.updateOne({ name }, { $set: { name, position } }, { upsert: true });
}

function project<T>(
  collection: MongoProjectionCollection<T>,
  projection: DocumentProjectionFunction<T>,
  options: DocumentProjectionOptions<T>
) {
  const { events, preload, merge, remove } = {
    merge: true,
    preload: false,
    remove: false,
    ...options,
  } as DocumentProjectionOptions<T>;
  const types = events !== undefined ? (_.isArray(events) ? events : [events]) : undefined;

  return async (event: PublishedEvent): Promise<void> => {
    const { aggregateId: id, type } = event;

    if (types === undefined || _.includes(types, type)) {
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
  name: string,
  collection: Collection<ProjectionDocument<T>>,
  projection: DocumentProjectionFunction<T>,
  options: DocumentProjectionOptions<T>
): ProjectionFunction<T> {
  const mongoCollection = new MongoProjectionCollection<T>(collection);
  const process = project<T>(mongoCollection, projection, options);

  return (event: PublishedEvent<T>) => {
    return serialize(async (event: PublishedEvent<T>) => {
      await process(event);
      await updatePosition(name, collection, event.id);
    })(event);
  };
}

export async function attach<T>(
  store: MongoEventStore,
  collection: Collection<ProjectionDocument<T>>,
  options: DocumentProjectionOptions<T>
): Promise<Subscription> {
  const { projection, name, events } = options;
  const mongoProjection = create(name, collection, projection, options);

  const types = events !== undefined ? (_.isArray(events) ? events : [events]) : undefined;
  const after = await position(name, collection);
  const streamOptions = { after };

  return store
    .stream(streamOptions)
    .filter(({ type }) => types === undefined || _.includes(types, type))
    .subscribe(
      event => mongoProjection(event),
      error => {
        config.logger.error("event stream error", error);
      },
      () => {
        config.logger.info("event stream completed");
      }
    ) as any;
}
