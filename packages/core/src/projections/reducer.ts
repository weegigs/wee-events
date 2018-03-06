import { OrderedMap } from "immutable";

import { SourceEvent, PublishedEvent } from "../types";
import { InternalInconsistencyError } from "../errors";

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
    return ordered.reduce(async (state, reducer, key) => {
      if (reducer === undefined || key === undefined) {
        throw new InternalInconsistencyError("Inconsistency found in combined reducer");
      }

      try {
        return reducer(await state, event);
      } catch (error) {
        throw new ReducerError(key, error);
      }
    }, Promise.resolve(state));
  };
}
