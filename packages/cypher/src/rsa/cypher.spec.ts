import crypto from "crypto";

import { RSACypher } from "./cypher";
import { KeyPair, KeySource } from "./keysource";
import { AggregateId } from "@weegigs/events-core";

const createKeySource = (): KeySource => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

  return async (_id: AggregateId): Promise<KeyPair> => {
    return {
      privateKey,
      publicKey,
    };
  };
};

describe("rsa cypher", () => {
  const id = { key: "test-id", type: "test-type" };
  const payload = { test: "test" };

  const keys = createKeySource();

  it("should encrypt payloads", async () => {
    const cypher = RSACypher.create({ keys });
    const data = await cypher.encrypt(id, payload);
    expect(data).toBeDefined();
  });

  it("should round trip payloads", async () => {
    const cypher = RSACypher.create({ keys });

    const data = await cypher.encrypt(id, payload);
    const recovered = await cypher.decrypt(id, data);

    expect(recovered).toEqual(payload);
  });
});
