import { Subscription } from "rxjs";

import { EventId, PublishedEvent } from "../types";
import { EventStore } from "../event-store";
import { AggregateId } from "../aggregate";

export interface Projection {
  attach(store: EventStore): Subscription;
  listen(listener: ProjectionListenerFunction): Subscription;
}

export type ProjectionPosition = EventId | undefined;
export type ProjectionFunction = (event: PublishedEvent) => void | Promise<void>;
export type ProjectionListenerFunction = (event: PublishedEvent) => void | Promise<void>;

export type RepresentationFunction = <T>(id: AggregateId) => Promise<T>;
