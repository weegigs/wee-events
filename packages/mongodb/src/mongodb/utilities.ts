import { Collection, IndexOptions } from "mongodb";

export async function createIndex(
  name: string,
  fields: Record<string, 1 | -1>,
  options: IndexOptions,
  collection: Collection
) {
  if (!await collection.indexExists(name)) {
    await collection.createIndex(fields, { ...options, name });
  }
}
