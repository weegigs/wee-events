import { Projection, ProjectionFunction } from "./types";
import { SerialProjection, SerialProjectionOptions } from "./serial-projection";

export function serialProjection(projection: ProjectionFunction, options?: SerialProjectionOptions): Projection {
  return new SerialProjection(projection, options);
}
