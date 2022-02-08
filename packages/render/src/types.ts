import * as T from "@effect-ts/core/Effect";
import { Entity, Payload } from "@weegigs/events-core";

export interface RenderFailure {
  readonly description: string;
}

export type Renderer<R, P extends Payload, A extends Payload> = T.RIO<R, (entity: Entity<P>) => T.IO<RenderFailure, A>>;
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
