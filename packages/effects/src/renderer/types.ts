import * as Effect from "effect/Effect";
import { Entity, Payload } from "@weegigs/events-core";

export interface RenderFailure {
  readonly description: string;
}

export type Renderer<R, P extends Payload, A extends Payload> = Effect.Effect<(entity: Entity<P>) => Effect.Effect<A, RenderFailure>, never, R>;
export namespace Renderer {
  export type IO<P extends Payload, A extends Payload = Payload> = Renderer<unknown, P, A>;
}

export type AnyRenderer<R> = Renderer<R, Payload, Payload>;
export namespace AnyRenderer {
  export type IO = AnyRenderer<unknown>;

  export const from = <R, P extends Payload, A extends Payload>(source: Renderer<R, P, A>): AnyRenderer<R> => {
    return source as unknown as AnyRenderer<R>;
  };
}
