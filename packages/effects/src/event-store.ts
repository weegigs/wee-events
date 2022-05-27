import * as T from "@effect-ts/core/Effect";
import { Has, tag } from "@effect-ts/core/Has";
import { pipe } from "@effect-ts/core";

import * as wee from "@weegigs/events-core";

export const EventStore = tag<wee.EventStore>();
export type HasEventStore = Has<wee.EventStore>;

export interface EventPublisher {
  publish: wee.Publisher
} ;
export const EventPublisher = tag<EventPublisher>();

export interface EventLoader {
  load: wee.EventStore.Loader
};
export const EventLoader = tag<EventLoader>();

export class LoaderError extends Error {
  constructor(public readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "LoaderError";

    Object.setPrototypeOf(this, LoaderError.prototype);
  }
}

export const load = (id: wee.AggregateId): T.Effect<Has<EventLoader>, LoaderError, wee.RecordedEvent[]> =>
  pipe(
    T.do,
    T.bind("loader", () => T.service(EventLoader)),
    T.bind("events", ({ loader }) =>
      T.tryCatchPromise(
        () => loader.load(id),
        (e) => new LoaderError(e)
      )
    ),
    T.map(({ events }) => events)
  );

export class PublisherError extends Error {
  constructor(public readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "PublisherError";

    Object.setPrototypeOf(this, PublisherError.prototype);
  }
}
export const publish = (
  aggregate: wee.AggregateId,
  events: wee.DomainEvent | wee.DomainEvent[],
  options?: wee.EventStore.PublishOptions
): T.Effect<
  Has<EventPublisher>,
  wee.ExpectedRevisionConflictError | wee.RevisionConflictError | PublisherError,
  wee.Revision
> =>
  pipe(
    T.do,
    T.bind("publisher", () => T.service(EventPublisher)),
    T.bind("revision", ({ publisher }) =>
      T.tryCatchPromise(
        async () => {
          return publisher.publish(aggregate, events, options);
        },
        (e) => new PublisherError(e)
      )
    ),
    T.map(({ revision }) => revision)
  );
