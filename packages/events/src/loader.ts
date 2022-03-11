import { AggregateId, Entity, Payload } from "./types";

export interface Loader<S extends Payload> {
  load(aggregate: AggregateId): Promise<Entity<S> | undefined>;
}
