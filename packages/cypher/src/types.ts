import { AggregateId, Payload } from "@weegigs/wee-events";

export * from "./tokenizer/types";

export type Cypher = {
  encrypt: (streamId: AggregateId, payload: Payload) => Promise<Buffer>;
  decrypt: (streamId: AggregateId, buffer: Buffer) => Promise<Payload>;
};
