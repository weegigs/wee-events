import { Constructor, Registry } from "../entity-service";

export const Reducer = (event: string): PropertyDecorator => {
  return (target, key) => {
    Registry.registerReducer(event, target.constructor as Constructor<any>, key);
  };
};
