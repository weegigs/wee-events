import * as T from "@effect-ts/core/Effect";

import { Entity } from "@weegigs/events-core";

import { AnyRenderer } from "./types";

export const defaultRenderer: AnyRenderer.IO = T.succeed((e: Entity) => T.succeed(e.state));
