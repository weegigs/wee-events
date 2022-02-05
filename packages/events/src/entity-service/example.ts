import { Entity, Command, DomainEvent, EmptyPayload, RecordedEvent } from "../types";
import { Reducer, PolicyHandler, CommandHandler } from "../decorators";

import { EntityController, Publisher } from "./types";

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

type StateEntity = Entity<State>;

export class Controller implements EntityController<State> {
  constructor(private log: (message: string) => void) {}

  readonly type = "example";

  init() {
    return { running: false, total: 0 };
  }

  @Reducer(Events.Incremented)
  applyIncrement(state: State, event: RecordedEvent<Events.Incremented>): State {
    if (!state.running) {
      this.log(`increment event received but the counter is not running. ignoring`);
      return state;
    }

    return { ...state, total: state.total + event.data.count };
  }

  @Reducer(Events.Stopped)
  applyStopped(state: State, _event: RecordedEvent<Events.Stopped>): State {
    return { ...state, running: false };
  }

  @Reducer(Events.Started)
  applyStarted(state: State, _event: RecordedEvent<Events.Started>): State {
    return { ...state, running: true };
  }

  @CommandHandler(Commands.Increment)
  async increment({ data: { count } }: Commands.Increment, { state, aggregate }: StateEntity, publish: Publisher) {
    if (state.running) {
      await publish(aggregate, {
        type: Events.Incremented,
        data: {
          count,
        },
      });
    }
  }

  @CommandHandler(Commands.Stop)
  async stop(_: EmptyPayload, { state, aggregate }: StateEntity, publish: Publisher) {
    if (state.running) {
      await publish(aggregate, {
        type: Events.Stopped,
        data: {},
      });
    }
  }

  @CommandHandler(Commands.Start)
  async start(_: EmptyPayload, { state, aggregate }: StateEntity, publish: Publisher) {
    if (!state.running) {
      await publish(aggregate, {
        type: Events.Started,
        data: {},
      });
    }
  }

  @PolicyHandler(Events.Incremented, Events.Started)
  async stopIfGreaterThan10(
    _previous: StateEntity,
    { state, aggregate }: StateEntity,
    _event: RecordedEvent,
    publish: Publisher
  ) {
    if (state.total > 10 && state.running) {
      await publish(aggregate, {
        type: Events.Stopped,
        data: {},
      });
    }
  }
}
