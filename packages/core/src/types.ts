import { AggregateId } from "./aggregate";

/** Universally Unique Lexicographically Sortable Identifier */
export type EventId = string;

export interface SourceEvent<T = any> {
  type: T;
  aggregateId: AggregateId;
}

export interface PublicationMetadata {
  id: EventId;
  publishedAt: Date;
}

export type PublishedEvent<T extends SourceEvent = any> = T & {
  __publicationMetadata: PublicationMetadata;
};
