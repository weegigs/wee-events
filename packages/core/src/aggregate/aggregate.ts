import * as R from "ramda";

import { Observable, Subject, BehaviorSubject } from "rxjs";
import { OrderedMap, OrderedSet } from "immutable";
import { success, failure, Result } from "../result";

import { Event, PublishedEvent } from "../types";
import { EventStore } from "../event-store";

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
        console.error(error);
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

        const update = process(version, command, allHandlers.get(command.command, noHandlers), this.publish)
          .withError(errors => resolve(failure(errors)))
          .withResult(async result => resolve(success(await result)));

        return update.result !== undefined ? update.result.then(r => r.version) : version;
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

function process(
  version: AggregateVersion,
  command: Command,
  handlers: OrderedSet<CommandHandler>,
  publish: (events: Event[]) => Promise<PublishedEvent[]>
) {
  return validate(version, command, handlers)
    .flatMap(handlers => run(version, command, handlers))
    .mapError(errors => errors.map<CommandError>(e => ({ ...e, version })))
    .map(events => publish(events))
    .map(async events => {
      const published = await events;
      const newVersion = versionFromEvents(version, published);

      return { events: published, version: newVersion };
    });
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

function run(
  version: AggregateVersion,
  command: Command,
  handlers: OrderedSet<CommandHandler>,
  events: Event[] = []
): CommandResult {
  return handlers.reduce(
    (result: CommandResult, handler) =>
      result.flatMap(a => {
        try {
          return handler.action(version, command).map(b => a.concat(b));
        } catch (error) {
          return failure([{ version, error }]);
        }
      }),
    success(events)
  );
}

function versionFromEvents(current: AggregateVersion, published: PublishedEvent[]): AggregateVersion {
  const latest = R.last(published);
  const version = (latest && latest.id) || current.version;
  return { id: current.id, version };
}
