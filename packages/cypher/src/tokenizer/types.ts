import { Payload } from "@weegigs/events-core";

import { $Tokenizer } from "./tokenizer";

export type TokenizeFunction = (path: string, v: string | number | boolean) => Promise<string>;

export type Tokenizer = {
  tokenize: (payload: Payload) => Promise<Payload>;
};

export namespace Tokenizer {
  export const create = (tokenize: TokenizeFunction): Tokenizer => {
    return {
      tokenize(payload: Payload): Promise<Payload> {
        return new $Tokenizer(tokenize).tokenize(payload);
      },
    };
  };
}
