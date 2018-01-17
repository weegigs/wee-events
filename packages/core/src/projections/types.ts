import { SourceEvent, EventId, PublishedEvent } from "../types";

export type ProjectionPosition = EventId | undefined;
export type ProjectionFunction<E extends SourceEvent = SourceEvent> = (
  event: PublishedEvent<E>
) => void | Promise<void>;

export type Reducer<S, E extends SourceEvent> = (state: S, event: PublishedEvent<E>) => S;
export type InitialReducer<S, E extends SourceEvent> = Reducer<S | undefined, E>;
