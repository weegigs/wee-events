import { Payload, List, Value, Primitive } from "@weegigs/events-core";

import { TokenizeFunction } from "./types";

function hash(str: string): number {
  let hash = 0,
    i = 0;
  const len = str.length;
  while (i < len) {
    hash = ((hash << 5) - hash + str.charCodeAt(i++)) << 0;
  }
  return hash;
}

export class $Tokenizer {
  private readonly $tokenize: TokenizeFunction;

  constructor(tokenize: TokenizeFunction) {
    this.$tokenize = tokenize;
  }

  private $list = async (path: string, list: List): Promise<List> => {
    const mapped = await Promise.all(list.map((value, index) => this.$value(`${path}.${index}`, value)));
    return mapped as List;
  };

  private $primitive = async (path: string, value: Primitive): Promise<Primitive> => {
    const tokenized = await this.$tokenize(path, value);

    if (typeof value === "string") {
      return tokenized;
    }

    const hashed = hash(tokenized);
    return typeof value === "number" ? hashed : hashed % 2 === 0;
  };

  private $value = async (path: string, value: Value): Promise<Value> => {
    // kao: looks odd but the compiler wont infer the correct type otherwise
    if (typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
      return this.$primitive(path, value);
    }

    if (Array.isArray(value)) {
      return this.$list(path, value);
    }

    return this.$payload(path, value);
  };

  private $payload = async (path: string, payload: Payload): Promise<Payload> => {
    const out: Payload = {};
    for (const key in payload) {
      out[key] = await this.$value(`${path}${path.length > 0 ? "." : ""}${key}`, payload[key]);
    }

    return out;
  };

  async tokenize(payload: Payload): Promise<Payload> {
    return this.$payload("", payload);
  }
}
