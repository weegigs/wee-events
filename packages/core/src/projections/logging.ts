import { PublishedEvent } from "../types";

import { Projection } from "./types";
import { serialProjection } from "./utilities";

export function loggingProjection(): Projection {
  return serialProjection((event: PublishedEvent) => {
    const { id, publishedAt, type } = event;
    console.log(`${publishedAt}: [${type}] ${id}`);
  });
}
