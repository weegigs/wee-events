import { Command, DomainEvent, EmptyPayload } from "../types";
import * as es from "../entity-service";

import { Controller } from "./controller";
import { CommandHandler, Reducer } from "./decorators";

export namespace Events {
  export const Incremented = "counter:incremented";
  export type Incremented = DomainEvent<
    "counter:incremented",
    {
      count: number;
    }
  >;

  export const Stopped = "counter:stopped";
  export type Stopped = DomainEvent<"counter:stopped", EmptyPayload>;

  export const Started = "counter:started";
  export type Started = DomainEvent<"counter:started", EmptyPayload>;
}

export namespace Commands {
  export const Increment = "counter:increment";
  export type Increment = Command<"counter:increment", { count: number }>;

  export const Start = "counter:start";
  export type Start = Command<"counter:start", EmptyPayload>;

  export const Stop = "counter:stop";
  export type Stop = Command<"counter:stop", EmptyPayload>;
}

export type State = {
  running: boolean;
  total: number;
};

export class ExampleController implements Controller<State> {
  constructor(private log: (message: string) => void) {}

  readonly type = "example";

  init() {
    return { running: false, total: 0 };
  }

  @Reducer(Events.Incremented)
  readonly applyIncrement: es.Reducer<State, Events.Incremented> = (state, event) => {
    if (!state.running) {
      this.log(`increment event received but the counter is not running. ignoring`);
      return state;
    }

    return { ...state, total: state.total + event.data.count };
  };

  @Reducer(Events.Stopped)
  applyStopped: es.Reducer<State, Events.Stopped> = (state, _event): State => {
    return { ...state, running: false };
  };

  @Reducer(Events.Started)
  applyStarted: es.Reducer<State, Events.Started> = (state, _event) => {
    return { ...state, running: true };
  };

  @CommandHandler(Commands.Increment)
  increment: es.CommandHandler<State, Commands.Increment> = async (
    { data: { count } },
    { state, aggregate },
    publish: es.Publisher
  ) => {
    if (state.running) {
      await publish(aggregate, {
        type: Events.Incremented,
        data: {
          count,
        },
      });
    }
  };

  @CommandHandler(Commands.Stop)
  stop: es.CommandHandler<State, Commands.Stop> = async (_, { state, aggregate }, publish: es.Publisher) => {
    if (state.running) {
      await publish(aggregate, {
        type: Events.Stopped,
        data: {},
      });
    }
  };

  @CommandHandler(Commands.Start)
  start: es.CommandHandler<State, Commands.Start> = async (_, { state, aggregate }, publish: es.Publisher) => {
    if (!state.running) {
      await publish(aggregate, {
        type: Events.Started,
        data: {},
      });
    }
  };
}
