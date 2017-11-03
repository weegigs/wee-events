import { OrderedSet } from "immutable";

import { Aggregate, AggregateId, AggregateVersion, Command, CommandHandler, ExecuteResult } from "../aggregate";
import { EventStore } from "../event-store";

import { Dispatcher } from "./types";

export class CommandDispatcher implements Dispatcher {
  private load: (id: AggregateId) => Aggregate;

  constructor(store: EventStore, handlers: CommandHandler[]) {
    this.load = (id: AggregateId) => new Aggregate(store, OrderedSet<CommandHandler>(handlers).toArray(), id);
  }

  execute(command: Command): Promise<ExecuteResult> {
    const { aggregateId } = command;
    const aggregate = this.load(aggregateId);

    return aggregate.execute(command);
  }

  version(id: AggregateId): Promise<AggregateVersion> {
    return this.load(id).version();
  }
}
