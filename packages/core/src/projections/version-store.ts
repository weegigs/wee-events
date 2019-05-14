import { AggregateId } from "../aggregate";
import { EventId, PublishedEvent } from "../types";

export type ObjectRecordValue = boolean | number | string | null | ObjectRecord | ObjectRecordRecordArray;
export interface ObjectRecord {
  [key: string]: ObjectRecordValue;
}
export interface ObjectRecordRecordArray extends Array<ObjectRecordValue> {}

export interface VersionRecord {
  id: AggregateId;
  version: EventId;
  events: PublishedEvent[];
  entity: ObjectRecord;
}

export interface VersionStore {
  write: (version: VersionRecord) => Promise<VersionRecord>;
  read: (id: AggregateId) => Promise<VersionRecord | undefined>;
}
