import { ProjectionFunction } from "@weegigs/events-core";

import { ProjectionOptions } from "../types";

export interface ListenerOptions extends ProjectionOptions {
  /** projection function to run */
  projection: ProjectionFunction;
}

export interface ListenerMetadata {
  name: string;
  position?: string;
}
