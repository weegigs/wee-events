import { Registry } from "./registry";
import { Constructor } from "./constructor";

export const CommandHandler = (command: string): PropertyDecorator => {
  return (target, key) => {
    Registry.registerHandler(command, target.constructor as Constructor<any>, key);
  };
};
