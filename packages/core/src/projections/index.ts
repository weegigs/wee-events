import { Subscription } from "rxjs/Subscription";
import { EventStore, ProjectionFunction, EventStreamOptions } from "../";
import { config } from "../config";

export * from "./types";
export * from "./logging";
export * from "./serial-projection";

export function attach<T>(
  store: EventStore,
  projection: ProjectionFunction<T>,
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
