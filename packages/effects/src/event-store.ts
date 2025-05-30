import { Effect, Context } from "effect";

import * as wee from "@weegigs/events-core";

export const EventStore = Context.GenericTag<wee.EventStore>("EventStore");
export type HasEventStore = wee.EventStore;

export interface EventPublisher {
  publish: wee.EventStore.Publisher;
}
export const EventPublisher = Context.GenericTag<EventPublisher>("EventPublisher");

export interface EventLoader {
  load: wee.EventStore.Loader;
}
export const EventLoader = Context.GenericTag<EventLoader>("EventLoader");

export class LoaderError extends Error {
  constructor(public override readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "LoaderError";

    Object.setPrototypeOf(this, LoaderError.prototype);
  }
}

export const load = (id: wee.AggregateId): Effect.Effect<wee.RecordedEvent[], LoaderError, EventLoader> =>
  Effect.gen(function* () {
    const loader = yield* EventLoader;
    const events = yield* Effect.tryPromise({
      try: () => loader.load(id),
      catch: (e) => new LoaderError(e)
    });
    return events;
  });

export class PublisherError extends Error {
  constructor(public override readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "PublisherError";

    Object.setPrototypeOf(this, PublisherError.prototype);
  }
}
export const publish = (
  aggregate: wee.AggregateId,
  events: wee.DomainEvent | wee.DomainEvent[],
  options?: wee.EventStore.PublishOptions
): Effect.Effect<
  wee.Revision,
  wee.ExpectedRevisionConflictError | wee.RevisionConflictError | PublisherError,
  EventPublisher
> =>
  Effect.gen(function* () {
    const publisher = yield* EventPublisher;
    const revision = yield* Effect.tryPromise({
      try: async () => {
        return publisher.publish(aggregate, events, options);
      },
      catch: (e) => new PublisherError(e)
    });
    return revision;
  });
