import { describe, it, expect } from "vitest";
import { AESCypher } from "./cypher";

describe("aes cypher", () => {
  const id = { key: "test-id", type: "test-type" };
  const payload = { test: "test" };

  it("should encrypt payloads", async () => {
    const cypher = AESCypher.create({ nonce: () => Buffer.from("123456789012") });
    const data = await cypher.encrypt(id, payload);
    expect(data).toBeDefined();
    expect(data).toMatchSnapshot();
  });

  it("should round trip payloads", async () => {
    const cypher = AESCypher.create({ nonce: () => Buffer.from("123456789012") });

    const data = await cypher.encrypt(id, payload);
    const recovered = await cypher.decrypt(id, data);

    expect(recovered).toEqual(payload);
  });
});
