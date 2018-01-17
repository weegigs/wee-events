import { Subscription } from "rxjs/Subscription";

import { EventStore, ProjectionFunction, EventStreamOptions } from "../";
import { config } from "../config";

export function attach(
  store: EventStore,
  projection: ProjectionFunction,
  options?: EventStreamOptions
): Subscription {
  return store.stream(options).subscribe(
    event => projection(event),
    error => {
      config.logger.error("event stream error", error);
    },
    () => {
      config.logger.info("event stream completed");
    }
  );
}
