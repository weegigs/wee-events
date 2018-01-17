import { SourceEvent, PublishedEvent, EventStreamOptions } from "@weegigs/events-core";
import { DocumentData } from "@google-cloud/firestore";

export type DocumentProjectionFunction<E extends SourceEvent = SourceEvent> = (
  event: PublishedEvent<E>,
  current?: DocumentData
) => Promise<DocumentData | undefined>;

export interface DocumentProjectionOptions extends EventStreamOptions {
  /** Only consider events for aggregates of type. Defaults to all types */
  type?: string;
  /** Provide existing data to projection function? Defaults to false */
  preload?: boolean;
  /** Merge projected data with existing data? Defaults to true */
  merge?: boolean;
  /** Delete document if projection returns undefined */
  remove?: boolean;
}
