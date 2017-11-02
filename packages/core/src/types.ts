import { AggregateId } from "./aggregate";

/** Universally Unique Lexicographically Sortable Identifier */
export type EventId = string;
export type EventType = string;

export type Dictionary = { [key: string]: DictionaryValue };
export interface DictionaryArray extends Array<DictionaryValue> {}
export type DictionaryValue = string | number | boolean | null | undefined | Date | Dictionary | DictionaryArray;

export interface Event {
  /** id from external system.
   *
   * This will be mapped to externalId in PublishedEvent
   */
  id?: string;
  type: EventType;
  aggregateId: AggregateId;
  data?: Dictionary;
}

export interface PublishedEvent {
  id: EventId;
  type: EventType;
  aggregateId: AggregateId;
  publishedAt: Date;
  key?: string;
  data?: Dictionary;
}
