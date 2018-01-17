import * as _ from "lodash";

import { SourceEvent, PublishedEvent, ProjectionFunction, serialize, eventId } from "@weegigs/events-core";
import { Collection } from "mongodb";
import { Subscription } from "rxjs";

import { MongoEventStore } from "../";
import { DocumentProjectionFunction, DocumentProjectionOptions } from "../types";
import { config } from "../config";

import { MongoProjectionCollection } from "./mongo-projection-collection";
import { ProjectionMetadata } from "./types";

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

function project<T, E extends SourceEvent = SourceEvent>(
  collection: MongoProjectionCollection<T>,
  projection: DocumentProjectionFunction<T, E>,
  options: DocumentProjectionOptions<T, E>
) {
  const { events, preload, merge, remove } = {
    merge: true,
    preload: false,
    remove: false,
    ...options,
  } as DocumentProjectionOptions<T>;
  const types = events !== undefined ? (_.isArray(events) ? events : [events]) : undefined;

  return async (event: PublishedEvent<E>): Promise<void> => {
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

function create<E extends SourceEvent = any>(
  name: string,
  collection: Collection,
  projection: DocumentProjectionFunction<any, any>,
  options: DocumentProjectionOptions<any>
): ProjectionFunction<E> {
  const mongoCollection = new MongoProjectionCollection<any>(collection);
  const process = project(mongoCollection, projection, options);

  return (event: PublishedEvent<E>) => {
    return serialize(async (event: PublishedEvent<E>) => {
      await process(event);
      await updatePosition(name, collection, eventId(event));
    })(event);
  };
}

export async function attach(
  store: MongoEventStore,
  collection: Collection,
  options: DocumentProjectionOptions<any>
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
