import { Constructor, Registry } from "../entity-service";

export const Creator = (command: string): MethodDecorator => {
  return (target, _propertyKey, descriptor) => {
    Registry.registerCreator(command, target.constructor as Constructor<any>, descriptor.value as any);

    return descriptor;
  };
};
