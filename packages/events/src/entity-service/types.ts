import { EventStore } from "../store";
import { Payload, AggregateId, RecordedEvent, DomainEvent, Command, Entity } from "../types";

export interface Controller<State extends Payload> {
  readonly type: string;

  init?: (aggregate: AggregateId) => State;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export type Constructor<T extends Object = Object> = new (...args: any[]) => T;

export type Publisher = EventStore["publish"];

export namespace Controller {
  export type Initializer<State extends Payload, Event extends DomainEvent> = (
    event: RecordedEvent<Event>
  ) => State | undefined;

  export type Reducer<State extends Payload, Event extends DomainEvent> = (
    state: State,
    event: RecordedEvent<Event>
  ) => State;

  export type Creator<C extends Command> = (command: C, target: AggregateId, publisher: Publisher) => Promise<void>;

  export type Handler<State extends Payload, C extends Command> = (
    command: C,
    state: Entity<State>,
    publisher: Publisher
  ) => Promise<void>;
}
