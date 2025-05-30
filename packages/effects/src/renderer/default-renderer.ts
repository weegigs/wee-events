import * as Effect from "effect/Effect";

import { Entity } from "@weegigs/events-core";

import { AnyRenderer } from "./types";

export const defaultRenderer: AnyRenderer.IO = Effect.succeed((e: Entity) => Effect.succeed(e.state));
