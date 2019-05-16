import { EventStreamOptions } from "../event-store";
import { EventId, PublishedEvent } from "../types";

export type Listener = (event: PublishedEvent) => Promise<void> | void;
export type EventFilter = (event: PublishedEvent) => boolean;

export interface ListenerOptions extends EventStreamOptions {
  /** Name of the listener */
  name: string;
  /** Only process events of type. Defaults to all types */
  events?: string | string[] | EventFilter;
}

export interface ListenerPositionStore {
  positionFor(listener: string): Promise<EventId | undefined>;
  updatePosition(listener: string, position: EventId): Promise<EventId>;
}
