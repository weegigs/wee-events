import crypto from "crypto";

import { AggregateId, Payload } from "@weegigs/wee-events";

import { Cypher } from "../types";

import { KeySource, identityHash } from "./keysource";

export namespace AESCypher {
  const rand = () => crypto.randomBytes(12);
  const algorithm = "aes-256-ccm";

  /***
   * nonce: optional function to provide a 12 byte buffer to be used as the IV
   *        if it's not supplied a secure random of 12 bytes is used
   * keySource: optional function used to retrieve the key for the entity
   *            if it's not supplied an identity hash is used
   */
  export type Options = { nonce?: () => Buffer; keySource?: KeySource };

  /***
   * Create an AES cypher that uses aes-256-ccm to process a given payload with a authTag length of 16 bytes
   * and a 12 byte IV
   *
   * The encrypted buffer contains a JSON string with the following fields
   *
   * nonce: the 12 byte nonce in base64
   * data: the encrypted data in base64
   * tag: the auth tag in base64
   *
   * @param options: cypher configurations
   */

  export function create(options: Options = {}): Cypher {
    const keySource = options?.keySource ?? identityHash;
    const nonceGenerator = options?.nonce ?? rand;

    return {
      encrypt: async (streamId: AggregateId, payload: Payload): Promise<Buffer> => {
        const key = await keySource(streamId);
        const nonce = nonceGenerator();

        const cypher = crypto.createCipheriv(algorithm, key, nonce, { authTagLength: 16 });
        const data: Buffer = Buffer.concat([cypher.update(JSON.stringify(payload)), cypher.final()]);

        return Buffer.from(
          JSON.stringify({
            nonce: nonce.toString("base64"),
            data: data.toString("base64"),
            tag: cypher.getAuthTag().toString("base64"),
          }),
          "utf-8"
        );
      },

      decrypt: async (streamId: AggregateId, buffer: Buffer): Promise<Payload> => {
        const key = await keySource(streamId);
        const { nonce, data, tag } = JSON.parse(buffer.toString("utf-8"));

        const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(nonce, "base64"), {
          authTagLength: 16,
        });
        decipher.setAuthTag(Buffer.from(tag, "base64"));

        const decrypted = Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]);

        return JSON.parse(decrypted.toString("utf-8"));
      },
    };
  }
}
