import { Dictionary, Event, EventId, PublishedEvent } from "../types";

export type AggregateType = string;
export type AggregateId = { id: string; type: AggregateType };

export interface AggregateVersion {
  readonly id: AggregateId;
  readonly version: EventId | undefined;
}

export type CommandType = string;
export interface Command {
  type: CommandType;
  aggregateId: AggregateId;
  data?: Dictionary;
}

export interface CommandHandler {
  type: CommandType;
  action: <T extends AggregateVersion>(aggregate: T, command: Command) => CommandResult;
}

export interface CommandError {
  version: AggregateVersion;
  error: Error;
}

export type ErrorResult = { errors: CommandError[] };
export type CommandResult = ErrorResult | { events: Event[] };
export type ExecuteResult = ErrorResult | { events: PublishedEvent[]; version: AggregateVersion };
