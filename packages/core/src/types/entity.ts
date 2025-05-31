import * as z from "zod";

import { AggregateId, Payload, Revision } from "./core";

export interface Entity<T extends Payload = Payload> {
  aggregate: AggregateId;
  type: string;
  revision: Revision;
  state: T;
}

export namespace Entity {
  export const schema = <Type extends string, Data extends z.ZodTypeAny>(type: Type, state: Data) =>
    z.object({
      aggregate: AggregateId.schema(type),
      type: z.string().min(1),
      revision: Revision.schema,
      state,
    });

  export function create<State extends Payload>(
    aggregate: AggregateId,
    type: string,
    revision: Revision,
    state: State
  ): Entity<State> {
    return { aggregate, type, revision, state } as const;
  }
}
