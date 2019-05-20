import * as async from "async";

import { AggregateVersion, loadAggregateVersion } from "../aggregate";
import { InternalInconsistencyError } from "../errors";
import { Listener } from "../listener";
import { SourceEvent, PublishedEvent } from "../types";
import { eventId } from "../utilities";

import { EventStore } from "../event-store";
import { InitialReducer } from "./types";
import { VersionStore, VersionRecord } from "./version-store";

export type Reducers = Record<string, InitialReducer<any, any>>;

export function createReducerProjection(events: EventStore, versions: VersionStore, reducers: Reducers): Listener {
  const writer = new ReducerWriter(versions, reducers);
  return async (event: PublishedEvent) => {
    const { aggregateId } = event;
    const eid = eventId(event);

    const current = await versions.read(aggregateId);
    if (current && current.version >= eid) {
      return;
    }

    let version = await loadAggregateVersion(events, event.aggregateId);
    await writer.write(version);
  };
}

export interface VersionWriter {
  write: (version: AggregateVersion) => Promise<VersionRecord | undefined>;
}

export class ReducerWriter implements VersionWriter {
  constructor(private readonly store: VersionStore, private readonly reducers: Reducers) {}

  write = async (version: AggregateVersion): Promise<VersionRecord | undefined> => {
    const { events, id, version: revision } = version;
    const reducer = this.reducers[id.type];

    if (!reducer) {
      return undefined;
    }

    if (undefined === revision) {
      throw new InternalInconsistencyError("attempting to save an aggregate version with no content");
    }

    const entity = await rehydrate(reducer, events);
    if (entity === undefined) {
      return undefined;
    }

    const record = {
      id,
      version: revision,
      entity,
    };

    return this.store.write(record);
  };
}

async function rehydrate<S>(reducer: InitialReducer<S, any>, events: SourceEvent[]): Promise<S | undefined> {
  return new Promise<S | undefined>((resolve, reject) => {
    async.reduce<SourceEvent, S | undefined>(
      events,
      undefined,
      async (state: S | undefined, event) => {
        const update = await reducer(state, event);
        return update;
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
  });
}
