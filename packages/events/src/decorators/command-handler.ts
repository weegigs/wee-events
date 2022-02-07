import { Constructor, Registry } from "../entity-service";

export const CommandHandler = (command: string): PropertyDecorator => {
  return (target, key) => {
    Registry.registerHandler(command, target.constructor as Constructor<any>, key);
  };
};
