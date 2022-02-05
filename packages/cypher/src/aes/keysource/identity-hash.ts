import { KeySource } from "./types";
import { AggregateId } from "@weegigs/wee-events";
import crypto from "crypto";

export const identityHash: KeySource = async (id: AggregateId) => {
  return crypto
    .createHash("sha256")
    .update(Buffer.from(`${id.key}:${id.type}`))
    .digest();
};
