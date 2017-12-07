import { queue, AsyncWorker } from "async";

import { ProjectionFunction } from "./types";
import { PublishedEvent } from "../index";
import { config } from "../config";

export function serialize<T>(projection: ProjectionFunction<T>): ProjectionFunction<T> {
  const worker: AsyncWorker<PublishedEvent<T>, Error> = async (event, done) => {
    try {
      await projection(event);
    } catch (error) {
      done(error);
    }
  };

  const jobs = queue(worker, 1);

  return (event: PublishedEvent<T>) =>
    jobs.push(event, (error: any) => {
      if (error) {
        config.logger.warn("projection failed to process event", {
          event: event.id,
          error: error.message || error,
        });
      }
    });
}
