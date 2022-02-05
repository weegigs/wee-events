import { AggregateId, RecordedEvent, Revision } from "./core";

export type Aggregate = {
  id: AggregateId;
  events: RecordedEvent[];
  revision: Revision;
};
