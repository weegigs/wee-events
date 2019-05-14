import { queue, AsyncWorker, AsyncQueue } from "async";
import { Map } from "immutable";

import { config } from "../config";
import { SourceEvent, PublishedEvent } from "../types";
import { eventId } from "../utilities";
import { AggregateId, aggregateKey } from "../aggregate";

import { ProjectionFunction } from "./types";

type Task = {
  projection: ProjectionFunction<any>;
  event: PublishedEvent<any>;
};

let queues: Map<string, AsyncQueue<Task>> = Map();

export function serialize<E extends SourceEvent>(projection: ProjectionFunction<E>): ProjectionFunction<E> {
  const worker: AsyncWorker<Task, Error> = async task => {
    const { event, projection } = task;
    try {
      await projection(event);
    } catch (error) {
      config.logger.error("failed to process event", {
        event: {
          id: eventId(event),
          type: event.type,
        },
        error,
        description: error.description || error.message,
      });
    }
  };

  const queueForAggregate = (aggregateId: AggregateId): AsyncQueue<Task> => {
    const { type, id } = aggregateId;
    const key = aggregateKey(aggregateId);
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
    queueForAggregate(event.aggregateId).push({ projection, event });
  };
}
