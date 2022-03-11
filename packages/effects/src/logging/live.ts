import * as T from "@effect-ts/core/Effect";
import * as L from "@effect-ts/core/Effect/Layer";

import SenseLog from "senselogs";

import { Stage } from "../environment";

import { Log } from "./effects";

const _log = T.gen(function* (_) {
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

export const live = L.fromEffect(Log)(_log);
