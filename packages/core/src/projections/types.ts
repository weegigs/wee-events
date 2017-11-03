import { Subscription } from "rxjs";

import { EventId, PublishedEvent } from "../types";
import { EventStore } from "../event-store";

export interface Projection {
  attach(store: EventStore): Subscription;
}

export type ProjectionPosition = EventId | undefined;
export type ProjectionFunction = (event: PublishedEvent) => void | Promise<void>;
