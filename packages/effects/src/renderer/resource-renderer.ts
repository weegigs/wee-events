import * as T from "@effect-ts/core/Effect";
import { pipe } from "@effect-ts/core";

import { Entity, Payload, Revision } from "@weegigs/events-core";

import { AnyRenderer, RenderFailure } from "./types";

export type Resource = {
  $self: string;
  $type: string;
  $revision: Revision;
} & Payload;

export type Locator = (entity: Entity) => string[];

export const resourceRenderer = <R>(
  self: Locator,
  render: AnyRenderer<R>
): T.Effect<R, never, (entity: Entity) => T.Effect<unknown, RenderFailure, Resource[]>> =>
  T.access(
    (e: R) => (entity: Entity) =>
      pipe(
        T.do,
        T.let("locations", () => self(entity)),
        T.bind("body", () =>
          pipe(
            render,
            T.chain((r) => r(entity))
          )
        ),
        T.map(($): Resource[] => {
          const { type: $type, revision: $revision } = entity;

          return $.locations.map((location) => {
            return { ...$.body, $self: location, $type, $revision };
          });
        }),
        T.provideAll(e)
      )
  );
