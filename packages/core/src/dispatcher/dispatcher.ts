import { OrderedSet, Map } from "immutable";
import { queue, AsyncWorker, AsyncQueue } from "async";

import { Aggregate, Command, CommandHandler, ExecuteResult, AggregateId } from "../aggregate";
import { EventStore } from "../event-store";
import { success, failure } from "../result";
import { InternalInconsistencyError } from "../errors";
import { config } from "../config";
import { VersionWriter } from "../projections";

import { Dispatcher } from "./types";

const loader = (store: EventStore, handlers: CommandHandler[]) => (id: AggregateId) => {
  return new Aggregate(store, OrderedSet<CommandHandler>(handlers).toArray(), id);
};

export class CommandDispatcher implements Dispatcher {
  private dispatch: (command: Command) => Promise<ExecuteResult>;

  constructor(store: EventStore, handlers: CommandHandler[]) {
    this.dispatch = dispatcher(loader(store, handlers), async (aggregate, command) => {
      return aggregate.execute(command);
    });
  }

  execute(command: Command): Promise<ExecuteResult> {
    return this.dispatch(command);
  }
}

export class StrongDispatcher implements Dispatcher {
  private dispatch: (command: Command) => Promise<ExecuteResult>;

  constructor(store: EventStore, handlers: CommandHandler[], writer: VersionWriter) {
    this.dispatch = dispatcher(loader(store, handlers), async (aggregate, command) => {
      let { value, error } = await aggregate.execute(command);

      if (error) {
        return failure(error);
      }

      if (!value) {
        throw new InternalInconsistencyError("result has neither a value or an error");
      }

      try {
        await writer.write(value.version);
      } catch (error) {
        return failure(error);
      }

      return success(value);
    });
  }

  execute(command: Command): Promise<ExecuteResult> {
    return this.dispatch(command);
  }
}

type Action = (aggregate: Aggregate, command: Command) => Promise<ExecuteResult>;
type Loader = (id: AggregateId) => Aggregate;

function dispatcher(loader: Loader, action: Action): (command: Command) => Promise<ExecuteResult> {
  return (command: Command) => {
    return new Promise((resolve, reject) => {
      queueFor(loader, command.aggregateId, action).push<ExecuteResult, Error>(command, (error, result) => {
        if (error) {
          resolve(failure(error));
        }

        if (result) {
          resolve(result);
        }

        throw new InternalInconsistencyError("queue returned neither a value or an error");
      });
    });
  };
}

let queues: Map<string, AsyncQueue<Command>> = Map();
function queueFor(loader: Loader, aggregateId: AggregateId, action: Action): AsyncQueue<Command> {
  const { type, id } = aggregateId;
  const key = `${type}|${id}`;
  let q = queues.get(key);
  if (q === undefined) {
    const worker: AsyncWorker<Command, Error> = async (command: Command): Promise<ExecuteResult> => {
      const { aggregateId } = command;
      const aggregate = loader(aggregateId);

      return action(aggregate, command);
    };

    q = queue(worker, 1);
    q.drain = () => {
      queues = queues.delete(key);
      config.logger.debug("command queue removed", { type, id });
    };
    queues = queues.set(key, q);
    config.logger.debug("command queue added", { type, id });
  }

  return q;
}
