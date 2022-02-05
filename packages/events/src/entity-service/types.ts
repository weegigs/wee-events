import { EventStore } from "../store";
import { Payload, AggregateId } from "../types";

export interface EntityController<State extends Payload> {
  readonly type: string;

  init?: (aggregate: AggregateId) => State;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export type Constructor<T extends Object = Object> = new (...args: any[]) => T;

export type Publisher = EventStore["publish"];
