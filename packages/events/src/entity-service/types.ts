import { EventStore } from "../store";
import { Payload, AggregateId, RecordedEvent, DomainEvent, Command, Entity } from "../types";

export type Publisher = EventStore["publish"];

export type Initializer<State extends Payload, Event extends DomainEvent> = (
  event: RecordedEvent<Event>
) => State | undefined;

export type Reducer<State extends Payload, Event extends DomainEvent> = (
  state: State,
  event: RecordedEvent<Event>
) => State;

export type Creator<C extends Command> = (command: C, target: AggregateId, publisher: Publisher) => Promise<void>;

export type CommandHandler<State extends Payload, C extends Command> = (
  command: C,
  state: Entity<State>,
  publisher: Publisher
) => Promise<void>;
