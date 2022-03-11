import { Registry } from "./registry";
import { Constructor } from "./constructor";

export const Reducer = (event: string): PropertyDecorator => {
  return (target, key) => {
    Registry.registerReducer(event, target.constructor as Constructor<any>, key);
  };
};
