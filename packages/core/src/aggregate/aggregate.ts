import * as R from "ramda";

import { Subject, BehaviorSubject, zip } from "rxjs";
import { OrderedMap, OrderedSet } from "immutable";

import { success, failure, Result } from "../result";
import { SourceEvent, PublishedEvent } from "../types";
import { EventStore } from "../event-store";
import { config } from "../config";
import { InternalInconsistencyError } from "../errors";

import { aggregateVersionFromEvents, aggregateKey } from "./utilities";

import {
  Command,
  CommandType,
  AggregateId,
  AggregateVersion,
  CommandResult,
  CommandHandler,
  ExecuteResult,
} from "./types";

type Action = (aggregate: AggregateVersion) => Promise<AggregateVersion>;
type CommandHandlers = OrderedMap<CommandType, OrderedSet<CommandHandler>>;

const noHandlers = OrderedSet<CommandHandler>();
const empty = OrderedMap<CommandType, OrderedSet<CommandHandler>>();

export class Aggregate {
  private handlers: CommandHandlers;
  private actions = new Subject<Action>();
  private versions: Subject<AggregateVersion | undefined>;

  constructor(private stream: EventStore, handlers: CommandHandler[], id: AggregateId) {
    this.versions = new BehaviorSubject<AggregateVersion | undefined>(undefined);
    this.handlers = groupHandlers(handlers);

    zip(this.actions, this.versions).subscribe(async ([action, version]) => {
      try {
        this.versions.next(await action(version || (await this.load(id))));
      } catch (error) {
        config.logger.error(`failed to process command`, { error });
        this.versions.next(version);
      }
    });
  }

  execute = (command: Command): Promise<ExecuteResult> => {
    const allHandlers = this.handlers;

    return new Promise<ExecuteResult>(async (resolve, reject) => {
      const action: Action = async (version: AggregateVersion) => {
        if (!R.equals(version.id, command.aggregateId)) {
          reject(new InternalInconsistencyError("Aggregate and Command id's don't match"));
        }

        const update = (await process(version, command, allHandlers.get(command.command, noHandlers), this.publish))
          .withError(errors => resolve(failure(errors)))
          .withValue(result => resolve(success(result)));

        return update.value !== undefined ? update.value.version : version;
      };

      this.actions.next(action);
    });
  };

  publish = async (events: SourceEvent | SourceEvent[]): Promise<PublishedEvent[]> => {
    return this.stream.publish(events);
  };

  /**
   * Returns the AggregateVersion
   */
  version = async (): Promise<AggregateVersion> => {
    return new Promise<AggregateVersion>((resolve, reject) => {
      const version: Action = async (version: AggregateVersion) => {
        resolve(version);
        return version;
      };

      this.actions.next(version);
    });
  };

  private async load(id: AggregateId): Promise<AggregateVersion> {
    const published = await this.stream.snapshot(id);
    const version = aggregateVersionFromEvents(id, published);

    return version;
  }
}

function groupHandlers(handlers: CommandHandler[]): CommandHandlers {
  return handlers.reduce((previous, next) => addHandler(previous, next), empty);
}

function addHandler(handlers: CommandHandlers, handler: CommandHandler): CommandHandlers {
  const { command } = handler;
  const existing = handlersForType(handlers, command);

  return handlers.set(command, existing.add(handler));
}

function handlersForType(handlers: CommandHandlers, type: CommandType): OrderedSet<CommandHandler> {
  return handlers.get(type, noHandlers);
}

async function process(
  version: AggregateVersion,
  command: Command,
  handlers: OrderedSet<CommandHandler>,
  publish: (events: SourceEvent[] | SourceEvent) => Promise<PublishedEvent[]>
): Promise<ExecuteResult> {
  const { value: valid, error: validationError } = validate(version, command, handlers);

  if (valid === undefined) {
    return failure(validationError || new InternalInconsistencyError("No handler or error generated"));
  }

  const { value: events, error } = await run(version, command, valid);

  if (events === undefined) {
    return failure(error || new InternalInconsistencyError("No events or error generated"));
  }

  if (Array.isArray(events) && events.length === 0) {
    return success({ events: [], version: version });
  }

  const published = await publish(events);
  const newVersion = aggregateVersionFromEvents(version.id, published, version);
  return success({ events: published, version: newVersion });
}

function validate(
  version: AggregateVersion,
  command: Command,
  handlers: OrderedSet<CommandHandler>,
  events: SourceEvent[] = []
): Result<OrderedSet<CommandHandler>, Error> {
  if (handlers.isEmpty()) {
    const error = new Error(`Aggregate ${aggregateKey(version.id)} has no handler for ${command.command}`);
    return failure(error);
  }

  return success(handlers);
}

async function run(
  version: AggregateVersion,
  command: Command,
  handlers: OrderedSet<CommandHandler>,
  events: SourceEvent[] = []
): Promise<CommandResult> {
  return handlers.reduce(async (current: Promise<CommandResult>, handler) => {
    const { value } = await current;

    if (value !== undefined) {
      const values = Array.isArray(value) ? value : [value];
      return (await handler.action(version, command)).map(events => values.concat(events));
    } else {
      return current;
    }
  }, Promise.resolve(success<SourceEvent<any>[], Error>(events)));
}
