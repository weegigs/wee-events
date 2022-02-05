import _ from "lodash";

import { EventStore } from "../store";
import { AggregateId, Entity, Payload, RecordedEvent, Revision } from "../types";
import { Registry, Constructor, EntityController } from "../entity-service";

export type Rehydrator<T extends Payload = Payload> = (aggregate: AggregateId) => Promise<Entity<T> | undefined>;

export namespace Rehydrator {
  export type Configuration = {
    events: EventStore;
  };

  export function create<S extends Payload, C extends EntityController<S>>(
    controller: C,
    { events }: Configuration
  ): Rehydrator<S> {
    const constructors: Constructor[] = [];

    let current = Object.getPrototypeOf(controller);
    constructors.push(current.constructor);

    // eslint-disable-next-line no-constant-condition
    while (true) {
      current = Object.getPrototypeOf(current);
      const constructor = current.constructor;

      if (constructor.name === "Object") {
        break;
      }

      constructors.push(constructor);
    }

    const registration = constructors
      .map((c) => Registry.registration(c))
      .reverse()
      .reduce((c, r) => c.merge(r), new Registry.Registration());

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new Service<S, C>({
      events,
      controller,
      registration,
    }).load;
  }
}

const revisionFor = (events: RecordedEvent[]) => {
  return _.last(events)?.revision ?? Revision.Initial;
};

class Service<S extends Payload, T extends EntityController<S>> {
  readonly #events: EventStore;

  readonly #type: string;
  readonly #controller: T;

  readonly #initializers: Record<string, Registry.Initializer>;
  readonly #reducers: Record<string, Registry.Reducer>;

  constructor({
    events,
    controller,
    registration,
  }: {
    events: EventStore;
    controller: T;
    registration: Registry.Registration;
  }) {
    this.#events = events;

    this.#controller = controller;
    this.#type = controller.type;

    this.#initializers = _.mapValues(registration.initializers, (r) => r.bind(controller));
    this.#reducers = _.mapValues(registration.reducers, (r) => r.bind(controller));
  }

  #replay(events: RecordedEvent[], state?: S): S | undefined {
    let result = state;

    for (const event of events) {
      if (result === undefined) {
        const handler = this.#initializers[event.type];
        if (handler !== undefined) {
          result = handler(event) as S;
        }
      } else {
        const handler = this.#reducers[event.type];
        if (handler !== undefined) {
          result = handler(result, event) as S;
        }
      }
    }

    return result;
  }

  #load = (aggregate: AggregateId, events: RecordedEvent[]): Entity<S> | undefined => {
    const initial = this.#controller.init !== undefined ? this.#controller.init(aggregate) : undefined;
    const state = this.#replay(events, initial);

    if (state === undefined) {
      return undefined;
    }

    const revision = revisionFor(events);
    return {
      aggregate,
      type: this.#type,
      state: state,
      revision,
    };
  };

  load = async (aggregate: AggregateId): Promise<Entity<S> | undefined> => {
    const events = await this.#events.load(aggregate);
    return this.#load(aggregate, events);
  };
}
