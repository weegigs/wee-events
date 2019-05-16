import { queue, AsyncWorker, AsyncQueue } from "async";
import { Map } from "immutable";

import { config } from "../config";
import { PublishedEvent } from "../types";
import { eventId } from "../utilities";
import { AggregateId, aggregateKey } from "../aggregate";

import { Listener } from "./types";

type Task = {
  listener: Listener;
  event: PublishedEvent<any>;
};

let queues: Map<string, AsyncQueue<Task>> = Map();

export function serializer(name: string, listener: Listener): Listener {
  const worker: AsyncWorker<Task, Error> = async task => {
    const { event, listener } = task;
    try {
      await listener(event);
    } catch (error) {
      config.logger.error(`serializer-${name}: failed to process event`, {
        name,
        aggregate: event.aggregateId,
        event: {
          id: eventId(event),
          type: event.type,
        },
        description: error.description || error.message,
        error,
      });
    }
  };

  const queueForAggregate = (aggregateId: AggregateId): AsyncQueue<Task> => {
    const { type, id } = aggregateId;
    const key = `${name}-${aggregateKey(aggregateId)}`;
    let q = queues.get(key);
    if (q === undefined) {
      q = queue(worker, 1);
      q.drain = () => {
        queues = queues.delete(key);
        config.logger.debug(`serializer-${name} queue removed for ${type}:${id} `, { name, type, id });
      };
      queues = queues.set(key, q);
      config.logger.debug(`serializer-${name} queue added for ${type}:${id} `, { name, type, id });
    }

    return q;
  };

  return event => {
    queueForAggregate(event.aggregateId).push({ listener, event });
  };
}
