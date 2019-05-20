import { VersionStore, VersionRecord, AggregateId } from "@weegigs/events-core";
import { Db, Collection } from "mongodb";

import { aggregateFilter } from "./aggregate-projections/utilities";

export type CollectionResolver = (id: AggregateId) => Collection;

export const createTypeNameCollectionResolver = (db: Db): ((id: AggregateId) => Collection) => {
  return (id: AggregateId) => {
    return db.collection(`version.${id.type}`);
  };
};

export class MongoVersionStore implements VersionStore {
  constructor(private readonly resolver: CollectionResolver) {}

  private collection = (id: AggregateId) => {
    return this.resolver(id);
  };

  write = async (version: VersionRecord): Promise<VersionRecord> => {
    // KAO: Multiple versions may exist in the version store
    // during a write.
    // Selection would need to be aware of the possibility of multiple versions and
    // return the most recent
    await this.collection(version.id).replaceOne(
      aggregateFilter(version.id),
      { _id: version.id, ...version },
      { upsert: true }
    );

    const collection = this.collection(version.id);
    try {
      await collection.insertOne({ _id: { ...version.id, version: version.version }, ...version });
      await collection.deleteMany({ _id: { ...version.id, version: { $lt: version.version } } });
    } catch (err) {
      if (err.code !== 11000) {
        throw err;
      }
    }

    return version;
  };

  read = async (id: AggregateId): Promise<VersionRecord | undefined> => {
    const query = this.collection(id)
      .find(aggregateFilter(id))
      .sort({ _id: { version: -1 } })
      .limit(1);

    try {
      const found = await query.next();
      return found || undefined;
    } finally {
      await query.close();
    }
  };
}
