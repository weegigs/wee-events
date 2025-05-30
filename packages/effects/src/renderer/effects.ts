import * as Effect from "effect/Effect";
import * as Context from "effect/Context";

import { Entity } from "@weegigs/events-core";
import { Resource } from "./resource-renderer";
import { RenderFailure } from "./types";

export type ResourceRenderer = (entity: Entity) => Effect.Effect<Resource, RenderFailure>;
export const ResourceRenderer = Context.GenericTag<ResourceRenderer>("ResourceRenderer");
export const resourceRenderer = ResourceRenderer;
