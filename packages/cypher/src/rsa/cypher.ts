import crypto from "crypto";

import { AggregateId, Payload } from "@weegigs/events-core";

import { Cypher } from "../types";

import { KeySource } from "./keysource";

export namespace RSACypher {
  /***
   * nonce: optional function to provide a 12 byte buffer to be used as the IV
   *        if it's not supplied a secure random of 12 bytes is used
   * keySource: optional function used to retrieve the key for the entity
   *            if it's not supplied an identity hash is used
   */
  export type Options = { keys: KeySource };

  /***
   * Creates an
   *
   * The encrypted buffer contains the encrypted event
   *
   * @param options: cypher configurations
   */

  export function create({ keys }: Options): Cypher {
    return {
      encrypt: async (streamId: AggregateId, payload: Payload): Promise<Buffer> => {
        const { publicKey } = await keys(streamId);

        const encrypted = crypto.publicEncrypt(
          {
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
          },
          Buffer.from(JSON.stringify(payload), "utf-8")
        );

        return encrypted;
      },

      decrypt: async (streamId: AggregateId, buffer: Buffer): Promise<Payload> => {
        const { privateKey } = await keys(streamId);

        const decrypted = crypto.privateDecrypt(
          {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
          },
          buffer
        );

        return JSON.parse(decrypted.toString("utf-8"));
      },
    };
  }
}
