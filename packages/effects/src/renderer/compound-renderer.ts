import * as Effect from "effect/Effect";
import { pipe } from "effect";

import { Entity } from "@weegigs/events-core";

import { AnyRenderer } from "./types";
import { defaultRenderer } from "./default-renderer";

export namespace CompoundRenderer {
  export const create = (renderers: Record<string, AnyRenderer.IO>): AnyRenderer.IO => {
    const renderer = (entity: Entity) => renderers[entity.type] ?? defaultRenderer;

    return Effect.succeed((entity: Entity) =>
      pipe(
        renderer(entity),
        Effect.flatMap((r) => r(entity))
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any;
  };
}
