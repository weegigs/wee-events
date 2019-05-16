import * as async from "async";

import { AggregateVersion, loadAggregateVersion } from "../aggregate";
import { SourceEvent } from "../types";
import { InternalInconsistencyError } from "../errors";

import { InitialReducer, ProjectionFunction } from "./types";
import { VersionStore, VersionRecord } from "./version-store";
import { EventStore } from "../event-store";

export type Reducers = Record<string, InitialReducer<any, any>>;

export function createVersionProjection(store: EventStore, writer: VersionWriter): ProjectionFunction {
  return async event => {
    let version = await loadAggregateVersion(store, event.aggregateId);
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
      events,
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
