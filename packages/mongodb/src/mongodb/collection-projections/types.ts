import { SourceEvent, PublishedEvent } from "@weegigs/events-core";

import { Collection } from "mongodb";

import { ProjectionOptions } from "../types";

export type CollectionProjectionFunction<E extends SourceEvent = SourceEvent> = (
  event: PublishedEvent<E>,
  collection: Collection
) => Promise<void>;

export interface CollectionProjectionOptions<E extends SourceEvent = any>
  extends ProjectionOptions {
  /** projection function to run */
  projection: CollectionProjectionFunction<E>;
}
