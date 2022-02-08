import { KeyObject } from "crypto";

import { AggregateId } from "@weegigs/events-core";

export type KeyPair = {
  publicKey: KeyObject;
  privateKey: KeyObject;
};

export type KeySource = (id: AggregateId) => Promise<KeyPair>;
