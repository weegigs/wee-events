import { KeyObject } from "crypto";

import { AggregateId } from "@weegigs/wee-events";

export type KeyPair = {
  publicKey: KeyObject;
  privateKey: KeyObject;
};

export type KeySource = (id: AggregateId) => Promise<KeyPair>;
