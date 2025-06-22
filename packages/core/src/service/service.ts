import { nanoid } from "nanoid";

import { EventStore } from "../store";
import { AggregateId, DomainEvent, Entity, Payload } from "../types";
import { Command, DespatcherDescription as DispatcherDescription, Environment } from "./dispatcher";
import { EntityDescription, LoaderDescription } from "./loader";
import { State } from "./state";

export type ServiceInfo<S extends Payload> = {
  version: string;
  title?: string;
  description?: string;
  entity: EntityDescription<S>;
};

export type Service<S extends State> = {
  // TODO: KAO - execute needs to be enhanced with a context for cross cutting concerns like authorization.
  execute: (name: string, target: AggregateId, command: Command) => Promise<Entity<S>>;
  load: (aggregate: AggregateId) => Promise<Entity<S>>;
};

export interface ServiceDescription<R extends Environment, S extends State> {
  info(): ServiceInfo<S>;

  commands: DispatcherDescription<R, S>["commands"];
  events: LoaderDescription<S>["events"];
  service(store: EventStore, environment: Omit<R, "publish">): Service<S>;
}

export namespace ServiceDescription {
  class TrackingPublisher {
    triggered = false;

    constructor(
      private store: EventStore,
      private command: string
    ) {}

    publish: EventStore.Publisher = async (
      aggregate: AggregateId,
      events: DomainEvent | DomainEvent[],
      options?: EventStore.PublishOptions
    ) => {
      const correlationId = options?.correlationId ?? `${this.command}/${nanoid(26)}`;
      const result = await this.store.publish(aggregate, events, { ...options, correlationId });
      this.triggered = true;

      return result;
    };
  }

  export function create<R extends Environment, S extends State>(
    info: {
      version: string;
      title?: string;
      description: string;
    },
    loader: LoaderDescription<S>,
    dispatcher: DispatcherDescription<R, S>
  ): ServiceDescription<R, S> {
    return {
      info: () => ({
        ...info,
        entity: loader.entity(),
      }),
      commands: dispatcher.commands,
      events: loader.events,
      service: (store: EventStore, environment: Omit<R, "publish">): Service<S> => {
        const load = loader.create(store).load;
        const execute = async (path: string, target: AggregateId, command: Command) => {
          const tracking = new TrackingPublisher(store, path);
          const dispatch = dispatcher.dispatcher({
            ...environment,
            publish: tracking.publish,
          } as unknown as R).dispatch;

          const entity = await load(target);

          await dispatch(path, entity, command);

          return tracking.triggered ? await load(target) : entity;
        };

        return {
          execute,
          load,
        };
      },
    };
  }
}
