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
      const { fileName, lineNumber, description, message } = error;

      config.logger.error(`${name}: failed to process ${event.type}`, {
        name,
        aggregate: event.aggregateId,
        event: {
          id: eventId(event),
          type: event.type,
        },
        description: description || message,
        fileName,
        lineNumber,
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
        config.logger.debug(`${name} queue removed for ${type}:${id} `, {
          name,
          type,
          id,
          "q-count": queues.count(),
        });
      };
      queues = queues.set(key, q);
      config.logger.debug(`${name} queue added for ${type}:${id} `, {
        name,
        type,
        id,
        "q-count": queues.count(),
      });
    }

    return q;
  };

  return event => {
    const { aggregateId } = event;
    const { type, id } = aggregateId;

    const q = queueForAggregate(aggregateId);
    q.push({ listener, event });
    config.logger.debug(`${name} event (${event.type}) added for ${type}:${id} `, {
      type,
      id,
      name,
      length: q.length(),
    });
  };
}
