import { Cypher, Tokenizer } from "../types";
import { AggregateId, Payload } from "@weegigs/events-core";

export const cypher: Cypher = {
  encrypt: async (_streamId: AggregateId, _payload: Payload): Promise<Buffer> => {
    throw new Error("encryption not supported, no cypher provided");
  },
  decrypt: async (_streamId: AggregateId, _buffer: Buffer): Promise<Payload> => {
    throw new Error("encryption not supported, no cypher provided");
  },
};

export const tokenizer: Tokenizer = {
  tokenize: async (_: Payload): Promise<Payload> => {
    throw new Error("encryption not supported, no tokenizer provided");
  },
};
