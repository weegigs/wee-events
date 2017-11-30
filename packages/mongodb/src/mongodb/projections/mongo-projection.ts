import { Collection } from "mongodb";

import { EventStreamOptions, ProjectionFunction, PublishedEvent, SerialProjection } from "@weegigs/events-core";

import { findProjectionMetadata } from "./utilities";
import { ProjectionMetadata } from "./types";

export class MongoProjection extends SerialProjection {
  constructor(
    collection: Collection<ProjectionMetadata>,
    metadata: ProjectionMetadata,
    projection: ProjectionFunction,
    options: EventStreamOptions = {}
  ) {
    super(projection, options);

    this.listen(async (event: PublishedEvent) => {
      await collection.update(
        { _id: metadata.name },
        { ...metadata, _id: metadata.name, position: event.id },
        { upsert: true }
      );
    });
  }
}

export async function createProjection(
  collection: Collection<ProjectionMetadata>,
  name: string,
  projection: ProjectionFunction,
  options?: EventStreamOptions
) {
  const metadata = await findProjectionMetadata(collection, name);
  return new MongoProjection(collection, metadata, projection, options);
}
