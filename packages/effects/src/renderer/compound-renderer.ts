import * as T from "@effect-ts/core/Effect";
import { pipe } from "@effect-ts/core";

import { Entity } from "@weegigs/events-core";

import { AnyRenderer } from "./types";
import { defaultRenderer } from "./default-renderer";

export namespace CompoundRenderer {
  export const create = (renderers: Record<string, AnyRenderer.IO>): AnyRenderer.IO => {
    const renderer = (entity: Entity) => renderers[entity.type] ?? defaultRenderer;

    return T.succeed((entity: Entity) =>
      pipe(
        renderer(entity),
        T.chain((r) => r(entity))
      )
    );
  };
}
