import { Constructor, Registry } from "../entity-service";

export const Reducer = (event: string): MethodDecorator => {
  return (target, _propertyKey, descriptor) => {
    Registry.registerReducer(event, target.constructor as Constructor<any>, descriptor.value as any);

    return descriptor;
  };
};
