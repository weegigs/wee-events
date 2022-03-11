import { AggregateId, Command, Entity, Payload } from "../types";

import { fromController as fc } from "./createServiceFromController";
import { createService } from "./createService";

export interface EntityService<S extends Payload> {
  load(aggregate: AggregateId): Promise<Entity<S> | undefined>;
  execute(aggregate: AggregateId, command: Command): Promise<Entity<S> | undefined>;
}

export namespace EntityService {
  export const fromController = fc;
  export const create = createService;
}
