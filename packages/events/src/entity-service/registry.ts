import _ from "lodash";

import { Entity, DomainEvent, RecordedEvent, Command, Payload, AggregateId } from "../types";
import { Constructor, Publisher } from "./types";

export namespace Registry {
  export type Initializer = (event: RecordedEvent<DomainEvent>) => Payload | undefined;
  export type Reducer = (state: Payload, event: RecordedEvent<DomainEvent>) => Payload;

  export type Creator = (command: Command, target: AggregateId, publisher: Publisher) => Promise<Entity>;
  export type Handler = (command: Command, state: Entity, publisher: Publisher) => Promise<Entity>;

  export type Policy = (
    previous: Entity | undefined,
    current: Entity,
    event: RecordedEvent<DomainEvent>,
    publisher: Publisher
  ) => Promise<Entity>;

  export class Registration {
    readonly initializers: Record<string, Initializer> = {};
    readonly reducers: Record<string, Reducer> = {};

    readonly creators: Record<string, Creator> = {};
    readonly handlers: Record<string, Handler> = {};
    readonly policies: Record<string, Policy> = {};

    registerInitializer = (event: string, method: Initializer) => {
      const current = this.initializers[event];
      if (current !== undefined) {
        throw new Error(`attempted to register multiple initializers handlers for ${event}`);
      }

      this.initializers[event] = method;
    };

    registerReducer = (event: string, method: Reducer) => {
      const current = this.reducers[event];
      if (current !== undefined) {
        throw new Error(`attempted to register multiple reducers for ${event}`);
      }

      this.reducers[event] = method;
    };

    registerCreator = (command: string, method: Creator) => {
      const current = this.creators[command];
      if (current !== undefined) {
        throw new Error(`attempted to register multiple creators for ${command}`);
      }

      this.creators[command] = method;
    };

    registerCommandHandler = (command: string, method: Handler) => {
      const current = this.handlers[command];
      if (current !== undefined) {
        throw new Error(`attempted to register multiple command handlers for ${command}`);
      }

      this.handlers[command] = method;
    };

    registerPolicyHandler = (event: string, method: Policy) => {
      const current = this.policies[event];
      if (current !== undefined) {
        throw new Error(`attempted to register multiple policies for ${event}`);
      }

      this.policies[event] = method;
    };

    merge = (other: Registration): Registration => {
      return _.merge(new Registration(), this, other);
    };
  }

  const registry: Map<Constructor<any>, Registration> = new Map();

  export const registration = (target: Constructor<any>) => {
    let registration = registry.get(target);
    if (undefined === registration) {
      registration = new Registration();
      registry.set(target, registration);
    }

    return registration;
  };

  export const registerInitializer = (event: string, target: Constructor<any>, method: Initializer) => {
    registration(target).registerInitializer(event, method);
  };

  export const registerReducer = (event: string, target: Constructor<any>, method: Reducer) => {
    registration(target).registerReducer(event, method);
  };

  export const registerCreator = (command: string, target: Constructor<any>, method: Creator) => {
    registration(target).registerCreator(command, method);
  };

  export const registerHandler = (command: string, target: Constructor<any>, method: Handler) => {
    registration(target).registerCommandHandler(command, method);
  };

  export const registerPolicy = (event: string, target: Constructor<any>, method: Policy) => {
    registration(target).registerPolicyHandler(event, method);
  };
}
