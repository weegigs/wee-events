import * as _ from "lodash";

import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";

import { EventStore } from "../event-store";
import { serialize } from "../projections";

import { ListenerPositionStore, ListenerOptions, Listener } from "./types";
import { PublishedEvent } from "../types";
import { eventId } from "../utilities";
import { config } from "../config";

function createEventFilter<E extends PublishedEvent>(events?: string | string[]): (event: E) => boolean {
  const types = events !== undefined ? (_.isArray(events) ? events : [events]) : undefined;
  return (event: E) => types === undefined || _.includes(types, event.type);
}

function createSerializedListener(
  name: string,
  listener: Listener,
  position: ListenerPositionStore,
  options: ListenerOptions
): Listener {
  return async (event: PublishedEvent) => {
    return serialize(async (event: PublishedEvent) => {
      await listener(event);
      await position.updatePosition(name, eventId(event));
    })(event);
  };
}

export async function attachListener(
  store: EventStore,
  position: ListenerPositionStore,
  listener: Listener,
  options: ListenerOptions
): Promise<Subscription> {
  const { name, events } = options;

  const after = await position.positionFor(name);
  const streamOptions = { after };

  const eventFilter = createEventFilter(events);
  const serialized = createSerializedListener(name, listener, position, options);

  return store
    .stream(streamOptions)
    .pipe(filter(eventFilter))
    .subscribe(
      event => serialized(event),
      error => {
        config.logger.error(`${name}: Event stream error`, error);
      },
      () => {
        config.logger.warning(`${name}: Event stream completed`);
      }
    ) as any;
}
