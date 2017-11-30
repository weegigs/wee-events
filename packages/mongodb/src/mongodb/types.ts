import { PublishedEvent, EventStreamOptions } from "@weegigs/events-core";

export type DocumentProjectionFunction<T> = (event: PublishedEvent, current?: T) => Promise<T | undefined>;

export interface DocumentProjectionOptions extends EventStreamOptions {
  /** Only consider events for aggregates of type. Defaults to all types */
  type?: string;
  /** Provide existing data to projection function? Defaults to false */
  preload?: boolean;
  /** Merge projected data with existing data? Defaults to true */
  merge?: boolean;
}
