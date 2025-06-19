import { describe, it, expect } from "vitest";
import { Payload } from "@weegigs/events-core";

import { TokenizeFunction, Tokenizer } from "./types";

const tokenize: TokenizeFunction = async (path, value) => {
  return `${path}|${value}`;
};

describe("tokenizer", () => {
  it("should tokenize a payload with simple values", async () => {
    const payload: Payload = {
      string: "string",
      number: 42,
      boolean: false,
    };

    const t = Tokenizer.create(tokenize);

    const result = await t.tokenize(payload);
    expect(result).toMatchSnapshot();
  });

  it("should tokenize a payload with nested payloads", async () => {
    const payload: Payload = {
      nested: {
        string: "string",
        number: 42,
        boolean: false,
      },
    };

    const t = Tokenizer.create(tokenize);

    const result = await t.tokenize(payload);
    expect(result).toMatchSnapshot();
  });

  it("should tokenize a payload with nested lists", async () => {
    const payload: Payload = {
      nested: [
        {
          string: "string",
          number: 42,
          boolean: false,
        },
        {
          string: "another",
          number: 96,
          boolean: true,
        },
      ],
    };

    const t = Tokenizer.create(tokenize);

    const result = await t.tokenize(payload);
    expect(result).toMatchSnapshot();
  });
});
