import { VersionStore, VersionRecord, AggregateId } from "@weegigs/events-core";

import { Db, Collection } from "mongodb";
import { aggregateFilter } from "./aggregate-projections/utilities";

export type CollectionResolver = (id: AggregateId) => Collection;

export const TypeNameCollectionResolver = (db: Db): ((id: AggregateId) => Collection) => {
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
    await this.collection(version.id).updateOne(
      aggregateFilter(version.id),
      { _id: version.id, ...version },
      { upsert: true }
    );
    return version;
  };

  read = async (id: AggregateId): Promise<VersionRecord | undefined> => {
    const found = await this.collection(id).findOne(aggregateFilter(id));
    return found || undefined;
  };
}
