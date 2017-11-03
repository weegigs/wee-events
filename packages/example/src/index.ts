import { Observable } from "rxjs";

import {
  AggregateVersion,
  Command,
  CommandDispatcher,
  CommandResult,
  CommandHandler,
  Event,
  createLoggingProjection,
  MemoryEventStore,
  SerialProjection,
  success,
} from "@weegigs/events-core";

class CounterProjection extends SerialProjection {
  count: number = 0;
  constructor(counter: string = "default") {
    super(event => {
      if (event.type === "incremented" && counter === event.aggregateId.id) {
        this.count++;
      }
    });
  }
}

function createCounter(counter?: string) {
  return new CounterProjection(counter);
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
const logger = createLoggingProjection();

[odd, even, logger].forEach(s => s.attach(store));

Observable.timer(0, 701).subscribe(async count => {
  const tick = count + 1;
  const result = await dispatcher.execute(createIncrementCommand(tick % 2 === 0 ? "even" : "odd"));

  result.withError(errors => {
    console.log(`[${tick} ${JSON.stringify(errors)}`);
  });

  result.withResult(result => {
    const version = result.version;
    const oddcount = odd.count;
    const evencount = even.count;

    console.log(`[${tick} = ${oddcount}:${evencount}] ${JSON.stringify(version)}`);
  });
});
