import { queue, AsyncWorker, AsyncQueue } from "async";
import { Map } from "immutable";

import { config } from "../config";
import { SourceEvent } from "../types";
import { ProjectionFunction } from "./types";
import { PublishedEvent, AggregateId } from "../index";

type Task = {
  projection: ProjectionFunction<any>;
  event: PublishedEvent<any>;
};

let queues: Map<string, AsyncQueue<Task>> = Map();

export function serialize<E extends SourceEvent>(projection: ProjectionFunction<E>): ProjectionFunction<E> {
  const worker: AsyncWorker<Task, Error> = async task => {
    await task.projection(task.event);
  };

  const queueForAggregate = (aggregateId: AggregateId): AsyncQueue<Task> => {
    const { type, id } = aggregateId;
    const key = `${type}|${id}`;
    let q = queues.get(key);
    if (q === undefined) {
      q = queue(worker, 1);
      q.drain = () => {
        queues = queues.delete(key);
        config.logger.debug("projection queue removed", { type, id });
      };
      queues = queues.set(key, q);
      config.logger.debug("projection queue added", { type, id });
    }

    return q;
  };

  return event => {
    const jobs = queueForAggregate(event.aggregateId);
    jobs.push({ projection, event }, (error: any) => {
      if (error) {
        config.logger.warn("projection failed to process event", {
          event,
          error,
        });
      }
    });
  };
}
