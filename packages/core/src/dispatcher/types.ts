import { AggregateId, AggregateVersion, Command, ExecuteResult } from "../aggregate";
import { ProjectionConsistency } from "../projections";

export type ExecuteConsistency = ProjectionConsistency | "full";

export type CommandExecutionOptions =
  | { consistency: "eventual" }
  | { consistency: "strong" | "full"; timeout?: number };

export interface Dispatcher {
  execute(command: Command, options?: CommandExecutionOptions): Promise<ExecuteResult>;
  version(id: AggregateId): Promise<AggregateVersion>;
}
