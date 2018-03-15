import { AggregateId, SourceEvent, PublishedEvent } from "@weegigs/events-core";

import { ProjectionOptions } from "../types";

export type AggregateProjectionFunction<T, E extends SourceEvent = SourceEvent> = (
  event: PublishedEvent<E>,
  current?: T
) => Promise<T | undefined>;

export interface AggregateProjectionOptions<T, E extends SourceEvent = any>
  extends ProjectionOptions {
  /** projection function to run */
  projection: AggregateProjectionFunction<T, E>;
  /** Provide existing data to projection function? Defaults to false */
  preload?: boolean;
  /** Merge projected data with existing data? Defaults to true */
  merge?: boolean;
  /** Delete document if projection returns undefined */
  remove?: boolean;
}

export interface AggregateProjectionDocument<T> {
  id: AggregateId;
  version: string;
  content: T;
}
