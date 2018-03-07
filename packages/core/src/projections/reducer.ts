import * as async from "async";

import { OrderedMap } from "immutable";

import { SourceEvent, PublishedEvent } from "../types";

import { Reducer } from "./types";

export class ReducerError extends Error {
  constructor(public reducer: string, public error: Error) {
    super(`[ReducerError] ${reducer} ${error.message}`);
    Object.setPrototypeOf(this, ReducerError.prototype);
  }
}

export function combineReducers<S, E extends SourceEvent = SourceEvent>(
  reducers: Record<string, Reducer<S, E>>
): Reducer<S, E> {
  const ordered = OrderedMap(reducers);

  return async (state: S, event: PublishedEvent<E>) => {
    const reducers = ordered.toArray();

    return new Promise<S>((resolve, reject) => {
      async.reduce(
        reducers,
        state,
        async (current, [key, reducer], complete) => {
          try {
            // the state as any is used as S may be defined as `X | undefined` making `undefined a valid value
            return await reducer(current as any, event);
          } catch (error) {
            throw new ReducerError(key, error);
          }
        },
        (error, updated) => {
          if (error) {
            reject(error);
          } else {
            resolve(updated);
          }
        }
      );
    });
  };
}
