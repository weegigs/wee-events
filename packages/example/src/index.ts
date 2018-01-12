import { Observable } from "rxjs";

import {
  AggregateVersion,
  Command,
  CommandDispatcher,
  CommandResult,
  CommandHandler,
  Event,
  MemoryEventStore,
  success,
  ProjectionFunction,
  serialize,
  LoggingProjection,
  attach,
} from "@weegigs/events-core";

const counters: Record<string, number> = {};

function createCounter(counter: string = "default"): ProjectionFunction {
  return serialize(event => {
    if (event.type === "incremented" && counter === event.aggregateId.id) {
      const current = counters[counter] || 0;
      counters[counter] = current + 1;
    }
  });
}

const INCREMENT_COMMAND = "increment";

const incrementHandler: CommandHandler = {
  command: INCREMENT_COMMAND,
  action: (aggregate: AggregateVersion, command: Command): CommandResult => {
    if (command.command === INCREMENT_COMMAND) {
      const incremented: Event = {
        aggregateId: aggregate.id,
        type: "incremented",
      };

      return success([incremented]);
    }

    return success([]);
  },
};

function createIncrementCommand(counter: string = "default"): Command {
  return {
    command: INCREMENT_COMMAND,
    aggregateId: {
      id: counter,
      type: "counter",
    },
  };
}

const handlers = [incrementHandler];

const store = new MemoryEventStore();
const dispatcher = new CommandDispatcher(store, handlers);

const odd = createCounter("odd");
const even = createCounter("even");
const logger = LoggingProjection.create();

[odd, even, logger].forEach(s => attach(store, s));

Observable.timer(0, 701).subscribe(async count => {
  const tick = count + 1;
  const result = await dispatcher.execute(createIncrementCommand(tick % 2 === 0 ? "even" : "odd"));

  result.withError(errors => {
    console.log(`[${tick} ${JSON.stringify(errors)}`);
  });

  result.withValue(result => {
    const version = result.version;
    const oddCount = counters["odd"];
    const evenCount = counters["even"];

    console.log(`[${tick} = ${oddCount}:${evenCount}] ${JSON.stringify(version)}`);
  });
});
