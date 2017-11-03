import { AggregateId, AggregateVersion, Command, ExecuteResult } from "../aggregate";

export interface Dispatcher {
  execute(command: Command): Promise<ExecuteResult>;
  version(id: AggregateId): Promise<AggregateVersion>;
}
