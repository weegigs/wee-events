import _ from "lodash";
import { nanoid } from "nanoid";

import { EventStore } from "../store";
import { AggregateId, Command, DomainEvent, Entity, Payload, RecordedEvent, Revision } from "../types";

import { Constructor, EntityController } from "./types";
import { Registry } from "./registry";

export interface EntityService<S extends Payload> {
  load(aggregate: AggregateId): Promise<Entity<S> | undefined>;

  execute(aggregate: AggregateId, command: Command): Promise<Entity<S> | undefined>;

  react(aggregate: AggregateId, event: DomainEvent): Promise<Entity<S> | undefined>;
}

export namespace EntityService {
  export type Configuration = {
    store: EventStore;
  };

  export function create<S extends Payload, C extends EntityController<S>>(
    controller: C,
    { store }: Configuration
  ): EntityService<S> {
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
      store,
      controller,
      registration,
    });
  }
}

const revisionFor = (events: RecordedEvent[]) => {
  return _.last(events)?.revision ?? Revision.Initial;
};

class Service<S extends Payload, T extends EntityController<S>> implements EntityService<S> {
  readonly #store: EventStore;
  readonly #publish: EventStore.Publisher;

  readonly #type: string;
  readonly #controller: T;

  readonly #initializers: Record<string, Registry.Initializer>;
  readonly #reducers: Record<string, Registry.Reducer>;

  readonly #creators: Record<string, Registry.Creator>;
  readonly #handlers: Record<string, Registry.Handler>;
  readonly #policies: Record<string, Registry.Policy>;

  constructor({
    store,
    controller,
    registration,
  }: {
    store: EventStore;
    controller: T;
    registration: Registry.Registration;
  }) {
    this.#store = store;
    this.#publish = store.publish.bind(store);

    this.#controller = controller;
    this.#type = controller.type;

    this.#initializers = _.mapValues(registration.initializers, (r) => r.bind(controller));
    this.#reducers = _.mapValues(registration.reducers, (r) => r.bind(controller));
    this.#creators = _.mapValues(registration.creators, (r) => r.bind(controller));
    this.#policies = _.mapValues(registration.policies, (r) => r.bind(controller));
    this.#handlers = _.mapValues(registration.handlers, (r) => r.bind(controller));
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
    const events = await this.#store.load(aggregate);
    return this.#load(aggregate, events);
  };

  execute = async (aggregate: AggregateId, command: Command): Promise<Entity<S> | undefined> => {
    const entity = await this.load(aggregate);

    const publish: EventStore.Publisher = (
      aggregate: AggregateId,
      events: DomainEvent | DomainEvent[],
      options?: EventStore.PublishOptions
    ) => {
      const correlationId = options?.correlationId ?? `${command.name}/${nanoid(26)}`;
      return this.#publish(aggregate, events, { ...options, correlationId });
    };

    if (entity === undefined) {
      const handler = this.#creators[command.name];
      if (handler === undefined) {
        throw new Error(`no creator found for command ${command.name}`);
      }

      await handler(command, aggregate, publish);
    } else {
      const handler = this.#handlers[command.name];
      if (handler === undefined) {
        throw new Error(`no handler found for command ${command.name}`);
      }

      await handler(command, entity, publish);
    }

    return this.load(aggregate);
  };

  react = async (aggregate: AggregateId, event: RecordedEvent<DomainEvent>): Promise<Entity<S> | undefined> => {
    const events = await this.#store.load(aggregate);

    const current = await this.#load(aggregate, events);
    if (current === undefined) {
      return undefined;
    }

    const handler = this.#policies[event.type];
    if (handler === undefined) {
      return current;
    }

    const publish: EventStore.Publisher = (
      aggregate: AggregateId,
      events: DomainEvent | DomainEvent[],
      options?: EventStore.PublishOptions
    ) => {
      const correlationId = options?.correlationId ?? event.metadata?.correlationId ?? `${event.type}/${nanoid(26)}`;
      return this.#publish(aggregate, events, { ...options, correlationId, causationId: event.id });
    };

    const previous = events.length === 0 ? current : this.#load(aggregate, events.slice(0, events.length - 1));

    await handler(previous, current, event, publish);

    return this.load(aggregate);
  };
}
