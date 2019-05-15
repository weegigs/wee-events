import { SourceEvent, PublishedEvent, ListenerPositionStore } from "@weegigs/events-core";
import { Collection } from "mongodb";
import { Subscription } from "rxjs";

import { MongoEventStore } from "../event-store";
import { attachListener } from "../listeners";
import { createEventFilter } from "../utilities";

import { CollectionProjectionOptions } from "./types";

function createCollectionProjection<E extends SourceEvent = SourceEvent>(
  collection: Collection,
  options: CollectionProjectionOptions<E>
) {
  const { projection, events } = options;
  const shouldProcess = createEventFilter(events);

  return async (event: PublishedEvent<E>): Promise<void> => {
    if (shouldProcess(event)) {
      await projection(event, collection);
    }
  };
}

export async function attachCollectionProjection(
  store: MongoEventStore,
  position: ListenerPositionStore,
  collection: Collection,
  options: CollectionProjectionOptions<any>
): Promise<Subscription> {
  const projection = createCollectionProjection(collection, options);
  const listenerOptions = { ...options, projection };

  return attachListener(store, position, listenerOptions);
}
