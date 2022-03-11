import _ from "lodash";

import { EventStore } from "../store";
import { Payload } from "../types";

import { Constructor, Controller } from "./types";
import { Registry } from "./registry";
import { EntityService } from "./service";
import { createService } from "./createService";

export type Configuration = {
  store: EventStore;
};

export function fromController<S extends Payload, C extends Controller<S>>(
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

  const type = controller.type;
  const init = controller.init ? { init: controller.init } : {};

  const initializers = _.mapValues(registration.initializers, (key) => _.get(controller, key).bind(controller));
  const reducers = _.mapValues(registration.reducers, (key) => _.get(controller, key).bind(controller));
  const creators = _.mapValues(registration.creators, (key) => _.get(controller, key).bind(controller));
  const handlers = _.mapValues(registration.handlers, (key) => _.get(controller, key).bind(controller));

  return createService<S>({
    store,
    type,
    ...init,
    initializers,
    reducers,
    creators,
    handlers,
  });
}
