import { Constructor, Registry } from "../entity-service";

export const PolicyHandler = (...events: string[]): MethodDecorator => {
  return (target, _propertyKey, descriptor) => {
    for (const event of events) {
      Registry.registerPolicy(event, target.constructor as Constructor<any>, descriptor.value as any);
    }

    return descriptor;
  };
};
