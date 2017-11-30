import { Collection } from "mongodb";

import { ProjectionMetadata } from "./types";

export async function findProjectionMetadata(
  collection: Collection<ProjectionMetadata>,
  name: string
): Promise<ProjectionMetadata> {
  const document = await collection.findOne({ name });

  return document === null ? { name, position: undefined } : document;
}
