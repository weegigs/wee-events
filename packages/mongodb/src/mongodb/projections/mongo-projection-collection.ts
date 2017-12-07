import { AggregateId, PublishedEvent } from "@weegigs/events-core";
import { Collection, DeleteWriteOpResultObject, UpdateWriteOpResult } from "mongodb";

import { ProjectionDocument } from "./types";
import { aggregateFilter } from "./utilities";

export class MongoProjectionCollection<T> {
  constructor(private collection: Collection<ProjectionDocument<T>>) {}

  async fetch(id: AggregateId): Promise<T | undefined> {
    const projection = await this.collection.findOne(aggregateFilter(id));
    return projection === null ? undefined : projection.content;
  }

  async updateProjection(event: PublishedEvent, content: T): Promise<UpdateWriteOpResult> {
    return this.collection.updateOne(
      aggregateFilter(event.aggregateId),
      { id: event.aggregateId, version: event.id, content },
      { upsert: true }
    );
  }

  async deleteProjection(id: AggregateId): Promise<DeleteWriteOpResultObject> {
    return this.collection.deleteOne(aggregateFilter(id));
  }

  async getProjection(id: AggregateId): Promise<ProjectionDocument<T> | undefined> {
    const document = await this.collection.findOne(aggregateFilter(id));
    return document === null ? undefined : document;
  }
}
