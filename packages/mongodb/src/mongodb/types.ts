import { SourceEvent, PublishedEvent, EventStreamOptions } from "@weegigs/events-core";

export type DocumentProjectionFunction<T, E extends SourceEvent = SourceEvent> = (
  event: PublishedEvent<E>,
  current?: T
) => Promise<T | undefined>;

export interface DocumentProjectionOptions<T, E extends SourceEvent = any> extends EventStreamOptions {
  /** Name of the projection */
  name: string;
  /** projection function to run */
  projection: DocumentProjectionFunction<T, E>;
  /** Only process events of type. Defaults to all types */
  events?: string | string[];
  /** Provide existing data to projection function? Defaults to false */
  preload?: boolean;
  /** Merge projected data with existing data? Defaults to true */
  merge?: boolean;
  /** Delete document if projection returns undefined */
  remove?: boolean;
}
