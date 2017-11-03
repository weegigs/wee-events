import { PublishedEvent } from "../types";

import { Projection } from "./types";
import { createSerialProjection } from "./serial-projection";

export function createLoggingProjection(): Projection {
  return createSerialProjection((event: PublishedEvent) => {
    const { id, publishedAt, type } = event;
    console.log(`${publishedAt}: [${type}] ${id}`);
  });
}
