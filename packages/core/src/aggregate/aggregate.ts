import * as R from "ramda";

import { Observable, Subject, BehaviorSubject } from "rxjs";
import { OrderedMap, OrderedSet } from "immutable";

import { success, failure, Result } from "../result";
import { Event, PublishedEvent } from "../types";
import { EventStore } from "../event-store";
import { config } from "../config";

import {
  Command,
  CommandType,
  AggregateId,
  AggregateVersion,
  CommandError,
  CommandResult,
  CommandHandler,
  ExecuteResult,
} from "./types";
import { aggregateKey } from "./utilities";

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

    Observable.zip(this.actions, this.versions).subscribe(async ([action, version]) => {
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
          reject(Error("Internal inconsistency. Aggregate and command don't match"));
        }

        const update = (await process(
          version,
          command,
          allHandlers.get(command.command, noHandlers),
          this.publish
        ))
          .mapError(errors => errors.map<CommandError>(e => ({ ...e, version })))
          .withError(errors => resolve(failure(errors)))
          .withValue(result => resolve(success(result)));

        return update.value !== undefined ? update.value.version : version;
      };

      this.actions.next(action);
    });
  };

  publish = async (events: Event[]): Promise<PublishedEvent[]> => {
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
    const version = versionFromEvents({ id, version: undefined }, published);

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
  publish: (events: Event[]) => Promise<PublishedEvent[]>
): Promise<ExecuteResult> {
  const { value: valid, error } = validate(version, command, handlers);

  if (valid !== undefined) {
    const { value: events, error } = await run(version, command, valid);

    if (events !== undefined) {
      const published = await publish(events);
      const newVersion = versionFromEvents(version, published);
      return success({ events: published, version: newVersion });
    } else {
      return failure(error || []);
    }
  } else {
    return failure(error || []);
  }
}

function validate(
  version: AggregateVersion,
  command: Command,
  handlers: OrderedSet<CommandHandler>,
  events: Event[] = []
): Result<OrderedSet<CommandHandler>, CommandError[]> {
  if (handlers.isEmpty()) {
    const error = Error(`Aggregate ${aggregateKey(version.id)} has no handler for ${command.command}`);
    return failure([{ version, error }]);
  }

  return success(handlers);
}

async function run(
  version: AggregateVersion,
  command: Command,
  handlers: OrderedSet<CommandHandler>,
  events: Event[] = []
): Promise<CommandResult> {
  return handlers.reduce(async (current: Promise<CommandResult>, handler) => {
    const { value } = await current;

    if (value !== undefined) {
      return (await handler.action(version, command)).map(events => value.concat(events));
    } else {
      return current;
    }
  }, Promise.resolve(success<Event<any>[], CommandError[]>(events)));
}

function versionFromEvents(current: AggregateVersion, published: PublishedEvent[]): AggregateVersion {
  const latest = R.last(published);
  const version = (latest && latest.id) || current.version;
  return { id: current.id, version };
}
