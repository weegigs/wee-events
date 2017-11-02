import * as R from "ramda";

import { Observable, Subject, BehaviorSubject } from "rxjs";
import { Map } from "immutable";

import { Event, PublishedEvent } from "../types";
import { EventStore } from "../event-store";

import {
  Command,
  AggregateId,
  AggregateVersion,
  CommandError,
  CommandResult,
  CommandHandler,
  ExecuteResult,
} from "./types";
import { aggregateKey, hasErrors } from "./utilities";

type Action = (aggregate: AggregateVersion) => Promise<AggregateVersion>;

export class Aggregate {
  private handlers: Map<string, CommandHandler>;
  private actions = new Subject<Action>();
  private versions: Subject<AggregateVersion | undefined>;

  constructor(private stream: EventStore, handlers: CommandHandler[], id: AggregateId) {
    this.versions = new BehaviorSubject<AggregateVersion | undefined>(undefined);

    const pairs = handlers.map<[string, CommandHandler]>(command => [command.type, command]);
    this.handlers = Map(pairs);

    Observable.zip(this.actions, this.versions).subscribe(async ([action, version]) => {
      try {
        this.versions.next(await action(version || (await this.load(id))));
      } catch (error) {
        console.error(error);
        this.versions.next(version);
      }
    });
  }

  execute(command: Command): Promise<ExecuteResult> {
    return new Promise<ExecuteResult>(async (resolve, reject) => {
      const action: Action = async (version: AggregateVersion) => {
        if (!R.equals(version.id, command.aggregateId)) {
          reject(Error("Internal inconsistency. Aggregate and command don't match"));
        }

        const handler = this.handlers.get(command.type);
        if (R.isNil(handler)) {
          resolve({
            errors: [
              {
                version,
                error: Error(`Aggregate ${aggregateKey(version.id)} has no handler for ${command.type}`),
              },
            ],
          });
          return version;
        }

        let result: CommandResult;
        try {
          result = handler.action(version, command);
        } catch (error) {
          result = { errors: [{ version, error }] };
        }

        if (hasErrors(result)) {
          const errors = result.errors.map<CommandError>(e => ({ ...e, version }));
          resolve({ errors });
          return version;
        }

        const published = await this.stream.publish(result.events);
        const newVersion = this.versionFromEvents(version, published);

        resolve({ events: published, version: newVersion });
        return newVersion;
      };

      this.actions.next(action);
    });
  }

  async publish(events: Event[]): Promise<PublishedEvent[]> {
    return this.stream.publish(events);
  }

  /**
   * Returns the AggregateVersion
   */
  async version(): Promise<AggregateVersion> {
    return new Promise<AggregateVersion>((resolve, reject) => {
      const version: Action = async (version: AggregateVersion) => {
        resolve(version);
        return version;
      };

      this.actions.next(version);
    });
  }

  private async load(id: AggregateId): Promise<AggregateVersion> {
    const published = await this.stream.snapshot(id);
    const version = this.versionFromEvents({ id, version: undefined }, published);

    return version;
  }

  private versionFromEvents(current: AggregateVersion, published: PublishedEvent[]): AggregateVersion {
    const latest = R.last(published);
    const version = (latest && latest.id) || current.version;
    return { id: current.id, version };
  }
}
