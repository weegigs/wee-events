import { AggregateId } from "./aggregate";

/** Universally Unique Lexicographically Sortable Identifier */
export type EventId = string;
export type EventType = string;

export interface Event<T = any> {
  type: EventType;
  aggregateId: AggregateId;
  data: T;
}

export interface PublishedEvent<T = any> {
  id: EventId;
  type: EventType;
  aggregateId: AggregateId;
  publishedAt: Date;
  data: T;
}
