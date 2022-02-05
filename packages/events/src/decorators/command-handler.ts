import { Constructor, Registry } from "../entity-service";

export const CommandHandler = (command: string): MethodDecorator => {
  return (target, _propertyKey, descriptor) => {
    Registry.registerHandler(command, target.constructor as Constructor<any>, descriptor.value as any);

    return descriptor;
  };
};
