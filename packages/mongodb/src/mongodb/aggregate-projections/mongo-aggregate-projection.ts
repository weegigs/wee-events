import * as _ from "lodash";

import { SourceEvent, PublishedEvent, ListenerPositionStore, attachListener } from "@weegigs/events-core";
import { Collection } from "mongodb";
import { Subscription } from "rxjs";

import { MongoEventStore } from "../event-store";
import { createEventFilter } from "../utilities";

import { MongoAggregateCollection } from "./mongo-aggregate-collection";
import { AggregateProjectionDocument, AggregateProjectionOptions } from "./types";

function createAggregateProjection<T, E extends SourceEvent = SourceEvent>(
  collection: Collection<AggregateProjectionDocument<T>>,
  options: AggregateProjectionOptions<T, E>
) {
  const { projection, events, preload, merge, remove } = {
    merge: true,
    preload: false,
    remove: false,
    ...options,
  } as AggregateProjectionOptions<T>;
  const aggregateCollection = new MongoAggregateCollection<T>(collection);
  const shouldProcess = createEventFilter(events);

  return async (event: PublishedEvent<E>): Promise<void> => {
    const { aggregateId: id } = event;

    if (shouldProcess(event)) {
      const current = preload || merge ? await aggregateCollection.fetch(id) : undefined;
      const data = await projection(event, current);
      if (data) {
        const content = merge === true ? _.merge(current, data) : data;
        await aggregateCollection.updateProjection(event, content);
      } else if (remove === true) {
        await aggregateCollection.deleteProjection(event.aggregateId);
      }
    }
  };
}

export async function attachAggregateProjection(
  store: MongoEventStore,
  position: ListenerPositionStore,
  collection: Collection,
  options: AggregateProjectionOptions<any>
): Promise<Subscription> {
  const projection = createAggregateProjection(collection, options);
  const listenerOptions = { ...options, projection };

  return attachListener(store, position, projection, listenerOptions);
}
