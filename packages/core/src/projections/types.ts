import { Observable, Subscription } from "rxjs";

import { EventId, PublishedEvent } from "../types";
import { EventStore } from "../event-store";

export type ProjectionConsistency = "strong" | "eventual";

export interface Projection {
  readonly consistency: ProjectionConsistency;
  readonly position: Observable<ProjectionPosition>;

  attach(store: EventStore): Subscription;
}

export type ProjectionPosition = EventId | undefined;
export type ProjectionFunction = (event: PublishedEvent) => void | Promise<void>;
