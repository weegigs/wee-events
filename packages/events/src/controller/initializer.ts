import { Registry } from "./registry";
import { Constructor } from "./constructor";

export const Initializer = (event: string): MethodDecorator => {
  return (target, _propertyKey, descriptor) => {
    Registry.registerInitializer(event, target.constructor as Constructor<any>, descriptor.value as any);

    return descriptor;
  };
};
