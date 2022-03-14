import _ from "lodash";

import { EntityService } from "../entity-service";
import { Loader } from "../loader";
import { EventStore } from "../store";
import { AggregateId, Payload } from "../types";

import { Constructor } from "./constructor";
import { Registry } from "./registry";

export interface Controller<State extends Payload> {
  readonly type: string;

  init?: (aggregate: AggregateId) => State;
}

export namespace Controller {
  export type Configuration = {
    store: EventStore;
  };

  export const service = <S extends Payload, C extends Controller<S>>(
    controller: C,
    { store }: Configuration
  ): EntityService<S> => {
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

    const type = controller.type;
    const init = controller.init ? { init: controller.init } : {};

    const initializers = _.mapValues(registration.initializers, (key) => _.get(controller, key).bind(controller));
    const reducers = _.mapValues(registration.reducers, (key) => _.get(controller, key).bind(controller));
    const creators = _.mapValues(registration.creators, (key) => _.get(controller, key).bind(controller));
    const handlers = _.mapValues(registration.handlers, (key) => _.get(controller, key).bind(controller));

    return EntityService.create<S>({
      store,
      type,
      ...init,
      initializers,
      reducers,
      creators,
      handlers,
    });
  };

  export const loader = () => {
    <S extends Payload, C extends Controller<S>>(controller: C, { store }: Configuration): Loader<S> => {
      const s = service<S, C>(controller, { store });

      return { load: s.load.bind(s) };
    };
  };
}
