import { queue, AsyncWorker, AsyncQueue } from "async";
import { Map } from "immutable";

import { ProjectionFunction } from "./types";
import { PublishedEvent, AggregateId } from "../index";
import { config } from "../config";

export function serialize<T>(projection: ProjectionFunction<T>): ProjectionFunction<T> {
  let queues: Map<string, AsyncQueue<PublishedEvent<T>>> = Map();

  const worker: AsyncWorker<PublishedEvent<T>, Error> = async event => {
    await projection(event);
  };

  const queueForAggregate = (aggregateId: AggregateId): AsyncQueue<PublishedEvent<T>> => {
    const { type, id } = aggregateId;
    const key = `${type}|${id}`;
    let q = queues.get(key);
    if (q === undefined) {
      q = queue(worker, 1);
      q.drain = () => {
        queues = queues.delete(key);
        config.logger.debug(`projection queue removed`, { type, id });
      };
      queues = queues.set(key, q);
      config.logger.debug(`projection queue added`, { type, id });
    }

    return q;
  };

  return (event: PublishedEvent<T>) => {
    const jobs = queueForAggregate(event.aggregateId);
    jobs.push(event, (error: any) => {
      if (error) {
        config.logger.warn("projection failed to process event", {
          event: event.id,
          error,
        });
      }
    });
  };
}
