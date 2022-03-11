import { AggregateId, Command, Entity, Payload } from "./types";

export interface Dispatcher<S extends Payload, C extends Command> {
  execute(aggregate: AggregateId, command: C): Promise<Entity<S> | undefined>;
}
