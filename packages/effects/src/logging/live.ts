import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import SenseLog from "senselogs";

import { Stage } from "../environment";

import { Log } from "./effects";

const _log = Effect.gen(function* (_) {
  const stage = yield* _(Stage);

  const log = new SenseLog().addContext({ stage });

  switch (stage) {
    case "production":
      break;

    case "preview":
      log.addFilter("debug");
      break;

    case "development":
      log.addFilter(["data", "trace", "debug"]);
      break;

    case "local":
      log.addFilter(["data", "trace", "debug"]);
      break;
  }

  return log;
});

export const live = Layer.effect(Log, _log);
