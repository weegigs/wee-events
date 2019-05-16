import { SourceEvent } from "../types";
import { serializer as s } from "../listener";

import { ProjectionFunction } from "./types";

export function serialize<E extends SourceEvent>(projection: ProjectionFunction<E>): ProjectionFunction<E> {
  return s("projection", projection);
}
