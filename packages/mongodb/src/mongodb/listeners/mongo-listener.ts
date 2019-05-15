import {
  eventId,
  ListenerPositionStore,
  ProjectionFunction,
  PublishedEvent,
  serialize,
  SourceEvent,
  EventId,
} from "@weegigs/events-core";
import { Collection } from "mongodb";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";

import { MongoEventStore } from "../event-store";
import { config } from "../config";
import { createEventFilter } from "../utilities";

import { ListenerMetadata, ListenerOptions } from "./types";

export class MongoListenerPositionStore implements ListenerPositionStore {
  constructor(private readonly collection: Collection) {}

  async positionFor(listener: string): Promise<EventId | undefined> {
    const { position } = await this.metadataFor(listener);
    return position;
  }

  async updatePosition(listener: string, position: EventId): Promise<EventId> {
    try {
      await this.collection.replaceOne({ _id: listener }, { listener, position }, { upsert: true });
      return position;
    } catch (error) {
      throw error;
    }
  }

  private async metadataFor(name: string): Promise<ListenerMetadata> {
    const document = await this.collection.findOne({ _id: name });
    return document === null ? { name } : document;
  }
}

function createProjection<E extends SourceEvent = any>(
  name: string,
  position: ListenerPositionStore,
  options: ListenerOptions
): ProjectionFunction<E> {
  const projection = options.projection;

  return (event: PublishedEvent<E>) => {
    return serialize(async (event: PublishedEvent<E>) => {
      await projection(event);
      await position.updatePosition(name, eventId(event));
    })(event);
  };
}

export async function attachListener(
  store: MongoEventStore,
  position: ListenerPositionStore,
  options: ListenerOptions
): Promise<Subscription> {
  const { name, events } = options;

  const after = await position.positionFor(name);
  const streamOptions = { after };

  const eventFilter = createEventFilter(events);
  const projection = createProjection(name, position, options);

  return store
    .stream(streamOptions)
    .pipe(filter(eventFilter))
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
