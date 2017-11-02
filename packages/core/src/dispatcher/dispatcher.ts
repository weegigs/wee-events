import * as R from "ramda";

import { OrderedSet } from "immutable";
import { Observable } from "rxjs";

import { timeout, latest } from "../utilities";
import { EventId } from "../types";
import {
  Aggregate,
  AggregateId,
  AggregateType,
  AggregateVersion,
  Command,
  CommandHandler,
  ExecuteResult,
  hasErrors,
} from "../aggregate";
import { EventStore } from "../event-store";
import { Projection } from "../projections";

import { CommandExecutionOptions, Dispatcher, ExecuteConsistency } from "./types";

export class CommandDispatcher implements Dispatcher {
  private projections = OrderedSet<Projection>();

  private load: (id: AggregateId) => Aggregate;

  constructor(
    private store: EventStore,
    handlers: { [type: string]: CommandHandler[] },
    projections: Projection[]
  ) {
    this.load = (id: AggregateId) => new Aggregate(this.store, handlers[id.type] || [], id);
    this.projections = OrderedSet(projections);

    projections.forEach(p => p.attach(this.store));
  }

  execute(
    command: Command,
    options: CommandExecutionOptions = { consistency: "eventual" }
  ): Promise<ExecuteResult> {
    return new Promise(async (resolve, reject): Promise<void> => {
      const { aggregateId: id } = command;
      const { consistency, timeout: duration } = { timeout: 5000, ...options } as any;

      const store = this.load(id);
      const result = await store.execute(command);

      if (hasErrors(result)) {
        resolve(result);
      } else {
        const projections = await timeout(duration, this.waitForProjections(id, result, consistency));
        if (projections === "timeout") {
          reject("timeout");
        } else {
          resolve(projections);
        }
      }
    });
  }

  version(id: AggregateId): Promise<AggregateVersion> {
    return this.load(id).version();
  }

  private async waitForProjections(id: AggregateId, result: ExecuteResult, consistency: ExecuteConsistency) {
    return new Promise<ExecuteResult>(async (resolve, reject) => {
      if (hasErrors(result)) {
        return resolve(result);
      }

      if (consistency === "eventual") {
        resolve(result);
      }

      const version: EventId = R.propOr(undefined, "version", latest(result.events, true));

      await this.waitForProjectionsWithConsistency(id.type, version, "strong").toPromise();
      if (consistency === "strong") {
        resolve(result);
      }

      await this.waitForProjectionsWithConsistency(id.type, version, "eventual").toPromise();
      resolve(result);
    });
  }

  private waitForProjectionsWithConsistency(
    type: AggregateType,
    version: EventId,
    consistency: ExecuteConsistency
  ): Observable<ExecuteConsistency> {
    const observables = this.projections
      .filter(p => p.consistency === consistency && R.pathOr(type, ["options", "aggregateType"], p) === type)
      .map<Observable<EventId>>(p => {
        return p.position
          .filter(update => updated(version, update))
          .map(v => v as EventId)
          .take(1);
      })
      .toArray();

    return Observable.concat(...observables)
      .last()
      .mapTo(consistency);
  }
}

function updated(current?: EventId, update?: EventId): boolean {
  if (undefined === update) return false;
  if (undefined === current) return true;
  else return update > current;
}
