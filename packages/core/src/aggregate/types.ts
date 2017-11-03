import { Dictionary, Event, EventId, PublishedEvent } from "../types";
import { Result } from "../result";

export type AggregateType = string;
export type AggregateId = { id: string; type: AggregateType };

export interface AggregateVersion {
  readonly id: AggregateId;
  readonly version: EventId | undefined;
}

export type CommandType = string;
export interface Command {
  command: CommandType;
  aggregateId: AggregateId;
  data?: Dictionary;
}

export interface CommandHandler {
  command: CommandType;
  action: <T extends AggregateVersion>(aggregate: T, command: Command) => CommandResult;
}

export interface CommandError {
  version: AggregateVersion;
  error: Error;
}

export type CommandResult = Result<Event[], CommandError[]>;
export type ExecuteResult = Result<{ events: PublishedEvent[]; version: AggregateVersion }, CommandError[]>;
