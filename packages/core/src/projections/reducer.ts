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

  return (state: S, event: PublishedEvent<E>) => {
    return ordered.reduce((state, reducer, key) => {
      if (reducer === undefined || key === undefined) {
        throw new InternalInconsistencyError("Inconsistency found in combined reducer");
      }

      try {
        return reducer(state, event);
      } catch (error) {
        throw new ReducerError(key, error);
      }
    }, state);
  };
}
