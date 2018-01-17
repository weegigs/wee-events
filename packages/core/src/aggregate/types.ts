import { SourceEvent, EventId, PublishedEvent } from "../types";
import { Result } from "../result";

export type AggregateType = string;
export type AggregateId = { id: string; type: AggregateType };

export interface AggregateVersion {
  readonly id: AggregateId;
  readonly version: EventId | undefined;
  readonly events: PublishedEvent[];
}

export type CommandType = string;
export interface Command<T = any> {
  command: CommandType;
  aggregateId: AggregateId;
  data: T;
}

export interface CommandHandler {
  command: CommandType;
  action: <T extends Command>(aggregate: AggregateVersion, command: T) => CommandResult | Promise<CommandResult>;
}

export interface ExecutionError {
  readonly version: AggregateVersion;
  readonly error: Error;
}

export type CommandResult<T = any> = Result<SourceEvent<T>[] | SourceEvent<T>, Error>;
export type ExecuteResult<E extends SourceEvent = any> = Result<
  { events: PublishedEvent<E>[]; version: AggregateVersion },
  ExecutionError
>;
