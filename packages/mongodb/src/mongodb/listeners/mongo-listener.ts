import { ListenerPositionStore, EventId } from "@weegigs/events-core";
import { Collection } from "mongodb";

import { ListenerMetadata } from "./types";

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
