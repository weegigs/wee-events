import { AggregateId, Payload } from "@weegigs/events-core";

export * from "./tokenizer/types";

export type Cypher = {
  encrypt: (streamId: AggregateId, payload: Payload) => Promise<Buffer>;
  decrypt: (streamId: AggregateId, buffer: Buffer) => Promise<Payload>;
};
