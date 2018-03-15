import { EventStreamOptions } from "@weegigs/events-core";

export interface ProjectionOptions extends EventStreamOptions {
  /** Name of the projection */
  name: string;
  /** Only process events of type. Defaults to all types */
  events?: string | string[];
}
