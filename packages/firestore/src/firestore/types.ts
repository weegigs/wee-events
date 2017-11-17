import { PublishedEvent, EventStreamOptions } from "@weegigs/events-core";
import { DocumentData } from "@google-cloud/firestore";

export type DocumentProjectionFunction = (
  event: PublishedEvent,
  current?: DocumentData
) => Promise<DocumentData | undefined>;

export interface DocumentProjectionOptions extends EventStreamOptions {
  /** Only consider events for aggregates of type. Defaults to all types */
  type?: string;
  /** Provide existing data to projection function? Defaults to false */
  preload?: boolean;
  /** Merge projected data with existing data? Defaults to true */
  merge?: boolean;
}
