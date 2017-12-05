import { AggregateId } from "@weegigs/events-core";
import { Collection } from "mongodb";

import { ProjectionMetadata } from "./types";

export async function findProjectionMetadata(
  collection: Collection<ProjectionMetadata>,
  name: string
): Promise<ProjectionMetadata> {
  const document = await collection.findOne({ name });

  return document === null ? { name, position: undefined } : document;
}

export function aggregateFilter(id: AggregateId) {
  return { "id.id": id.id, "id.type": id.type };
}
