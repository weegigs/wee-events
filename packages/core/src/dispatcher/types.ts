import { Command, ExecuteResult } from "../aggregate";

export interface Dispatcher {
  execute(command: Command): Promise<ExecuteResult>;
}
