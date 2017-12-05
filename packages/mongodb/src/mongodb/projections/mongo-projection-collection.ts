import { AggregateId } from "@weegigs/events-core";
import { Collection } from "mongodb";

import { ProjectionDocument } from "./types";
import { aggregateFilter } from "./utilities";

export class MongoProjectionCollection<T> {
  constructor(private collection: Collection<ProjectionDocument<T>>) {}

  async fetch(id: AggregateId): Promise<T | undefined> {
    const projection = await this.collection.findOne(aggregateFilter(id));
    return projection === null ? undefined : projection.content;
  }
}
