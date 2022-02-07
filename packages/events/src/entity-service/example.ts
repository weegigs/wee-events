import { Command, DomainEvent, EmptyPayload } from "../types";
import { Reducer, CommandHandler } from "../decorators";

import { Controller, Publisher } from "./types";

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
  readonly applyIncrement: Controller.Reducer<State, Events.Incremented> = (state, event) => {
    if (!state.running) {
      this.log(`increment event received but the counter is not running. ignoring`);
      return state;
    }

    return { ...state, total: state.total + event.data.count };
  };

  @Reducer(Events.Stopped)
  applyStopped: Controller.Reducer<State, Events.Stopped> = (state, _event): State => {
    return { ...state, running: false };
  };

  @Reducer(Events.Started)
  applyStarted: Controller.Reducer<State, Events.Started> = (state, _event) => {
    return { ...state, running: true };
  };

  @CommandHandler(Commands.Increment)
  increment: Controller.Handler<State, Commands.Increment> = async (
    { data: { count } },
    { state, aggregate },
    publish: Publisher
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
  stop: Controller.Handler<State, Commands.Stop> = async (_, { state, aggregate }, publish: Publisher) => {
    if (state.running) {
      await publish(aggregate, {
        type: Events.Stopped,
        data: {},
      });
    }
  };

  @CommandHandler(Commands.Start)
  start: Controller.Handler<State, Commands.Start> = async (_, { state, aggregate }, publish: Publisher) => {
    if (!state.running) {
      await publish(aggregate, {
        type: Events.Started,
        data: {},
      });
    }
  };
}
