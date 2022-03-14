import { DomainEvent, RecordedEvent, Revision, AggregateId } from "../types";

export interface EventStore {
  publish(
    aggregate: AggregateId,
    events: DomainEvent | DomainEvent[],
    options?: EventStore.PublishOptions
  ): Promise<Revision>;
  load(aggregate: AggregateId, options?: EventStore.LoadOptions): Promise<RecordedEvent[]>;
}

export namespace EventStore {
  export type Publisher = EventStore["publish"];
  export type Loader = EventStore["load"];

  export type PublishOptions = RecordedEvent.Metadata & {
    expectedRevision?: string;
    encrypt?: boolean;
  };

  export type LoadOptions = {
    afterRevision?: string;
    decrypt?: boolean;
  };
}
