import { Cypher, Tokenizer } from "@weegigs/events-cypher";
import { AggregateId, DomainEvent, RecordedEvent } from "@weegigs/events-core";
import { DateTime } from "luxon";
import { decodeTime, monotonicFactory } from "ulid";
import * as z from "zod";

import { EncryptedEvent } from "./types";

const ulid = monotonicFactory();

const ts = (id: string) => DateTime.fromMillis(decodeTime(id), { zone: "utc" }).toISO();

async function compress(input: string): Promise<Buffer> {
  // return snappy.compress(input);
  return Buffer.from(input, "utf-8");
}

async function uncompress(compressed: Buffer): Promise<Buffer> {
  // return snappy.uncompress(compressed);
  return compressed;
}

export type ChangeSet = {
  pk: string;
  sk: string;
  events: string;
  revision: string;
};

export namespace ChangeSet {
  export const schema: z.Schema<ChangeSet> = z.object({
    pk: z.string().min(1),
    sk: z.string().min(1),
    events: z.string(),
    revision: z.string().min(26).max(26),
  });

  export const create = async (aggregate: AggregateId, recorded: RecordedEvent[]) => {
    const { revision } = recorded[recorded.length - 1];
    const compressed = await compress(JSON.stringify(recorded));

    const changeSet: ChangeSet = {
      pk: AggregateId.encode(aggregate),
      sk: `change-set#${revision}`,
      events: compressed.toString("base64"),
      revision: revision,
    };

    return changeSet;
  };

  export type ChangeSetDecoder = (changeSet: ChangeSet, decrypt: boolean) => Promise<RecordedEvent[]>;

  export const decoder: (cypher: Cypher) => ChangeSetDecoder =
    (cypher: Cypher) => async (v: ChangeSet, decrypt: boolean) => {
      const decompressed = await uncompress(Buffer.from(v.events, "base64"));
      const parsed: RecordedEvent[] = JSON.parse(decompressed.toString("utf-8"));

      const decrypted = decrypt
        ? parsed.map(async (event) => {
            if (!EncryptedEvent.isEncrypted(event)) {
              return event;
            }

            const data = await cypher.decrypt(event.aggregate, Buffer.from(event.encrypted, "base64"));
            return { ...event, data };
          })
        : parsed;

      return Promise.all(decrypted);
    };

  export type EventEncoder = (
    aggregate: AggregateId,
    event: DomainEvent,
    metadata: RecordedEvent.Metadata,
    encrypt: boolean
  ) => Promise<RecordedEvent | (RecordedEvent & { encrypted: Buffer })>;

  export const encoder =
    (cypher: Cypher, tokenizer: Tokenizer): EventEncoder =>
    async (
      aggregate: AggregateId,
      event: DomainEvent,
      metadata: RecordedEvent.Metadata,
      encrypt: boolean
    ): Promise<RecordedEvent | EncryptedEvent> => {
      const id = ulid();
      const timestamp = ts(id);

      const recorded: RecordedEvent = {
        ...event,
        id,
        revision: id,
        aggregate: aggregate,
        timestamp,
        metadata,
      };

      if (!encrypt) {
        return recorded;
      }

      const encrypted = await cypher.encrypt(aggregate, event.data);
      const data = await tokenizer.tokenize(event.data);

      return { ...recorded, data, encrypted: encrypted.toString("base64") };
    };
}
