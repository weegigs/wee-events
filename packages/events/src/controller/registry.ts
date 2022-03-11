import _ from "lodash";

import { Entity, DomainEvent, RecordedEvent } from "../types";
import { Publisher } from "../entity-service/types";
import { Constructor } from "./constructor";

export namespace Registry {
  export type Policy = (
    previous: Entity | undefined,
    current: Entity,
    event: RecordedEvent<DomainEvent>,
    publisher: Publisher
  ) => Promise<Entity>;

  export class Registration {
    readonly initializers: Record<string, symbol | string> = {};
    readonly reducers: Record<string, symbol | string> = {};

    readonly creators: Record<string, symbol | string> = {};
    readonly handlers: Record<string, symbol | string> = {};

    registerInitializer = (event: string, key: symbol | string) => {
      const current = this.initializers[event];
      if (current !== undefined) {
        throw new Error(`attempted to register multiple initializers handlers for ${event}`);
      }

      this.initializers[event] = key;
    };

    registerReducer = (event: string, key: symbol | string) => {
      const current = this.reducers[event];
      if (current !== undefined) {
        throw new Error(`attempted to register multiple reducers for ${event}`);
      }

      this.reducers[event] = key;
    };

    registerCreator = (command: string, key: symbol | string) => {
      const current = this.creators[command];
      if (current !== undefined) {
        throw new Error(`attempted to register multiple creators for ${command}`);
      }

      this.creators[command] = key;
    };

    registerCommandHandler = (command: string, key: symbol | string) => {
      const current = this.handlers[command];
      if (current !== undefined) {
        throw new Error(`attempted to register multiple command handlers for ${command}`);
      }

      this.handlers[command] = key;
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

  export const registerInitializer = (event: string, target: Constructor<any>, key: symbol | string) => {
    registration(target).registerInitializer(event, key);
  };

  export const registerReducer = (event: string, target: Constructor<any>, key: symbol | string) => {
    registration(target).registerReducer(event, key);
  };

  export const registerCreator = (command: string, target: Constructor<any>, key: symbol | string) => {
    registration(target).registerCreator(command, key);
  };

  export const registerHandler = (command: string, target: Constructor<any>, key: symbol | string) => {
    registration(target).registerCommandHandler(command, key);
  };
}
