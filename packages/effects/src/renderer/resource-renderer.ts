import { Effect } from "effect";

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
): Effect.Effect<(entity: Entity<Payload>) => Effect.Effect<Resource[], RenderFailure, never>, never, R> =>
  Effect.gen(function* () {
    const env = yield* Effect.context<R>();
    return (entity: Entity<Payload>) =>
      Effect.gen(function* () {
        const locations = self(entity);
        const renderFn = yield* render;
        const body = yield* renderFn(entity);
        const { type: $type, revision: $revision } = entity;

        return locations.map((location) => {
          return { ...body, $self: location, $type, $revision };
        });
      }).pipe(Effect.provide(env)) as Effect.Effect<Resource[], RenderFailure, never>;
  });
