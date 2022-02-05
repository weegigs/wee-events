import * as T from "@effect-ts/core/Effect";
import { Has, tag } from "@effect-ts/core/Has";

import { Entity } from "@weegigs/wee-events";
import { Resource } from "./resource-renderer";
import { RenderFailure } from "./types";

export type ResourceRenderer = (entity: Entity) => T.IO<RenderFailure, Resource>;
export const ResourceRenderer = tag<ResourceRenderer>();
export type HasResourceRenderer = Has<ResourceRenderer>;
export const resourceRenderer = T.service(ResourceRenderer);
