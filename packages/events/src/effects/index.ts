import * as T from "@effect-ts/core/Effect";
import * as O from "@effect-ts/core/Option";

import { AggregateId, Command, DomainEvent, Entity, Payload } from "../types";

interface Failure {
  message: string;
  cause?: unknown;
}

export interface CommandFailure extends Failure {
  __tag: "CommandFailure";
}

export interface PolicyFailure extends Failure {
  __tag: "PolicyFailure";
}

export interface EntityService<S extends Payload> {
  load(aggregate: AggregateId): T.IO<unknown, O.Option<Entity<S>>>;
  execute(aggregate: AggregateId, command: Command): T.IO<CommandFailure, O.Option<Entity<S>>>;
  policy(aggregate: AggregateId, event: DomainEvent): T.IO<PolicyFailure, O.Option<Command>>;
}
