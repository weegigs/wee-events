import { config } from "../config";
import { SourceEvent, PublishedEvent } from "../types";
import { eventMetadata } from "../utilities";

import { ProjectionFunction, serialize } from "./";

export interface EventLogger {
  (event: PublishedEvent, message?: string, namespace?: string): void;
}

const defaultLogger: EventLogger = (event, message, namespace) => {
  const { type } = event;
  const { id, publishedAt } = eventMetadata(event);
  const prefix = namespace === undefined ? "" : `${namespace}: `;
  const suffix = message === undefined ? "" : ` - ${message}`;
  config.logger.debug(`${prefix}[${type}] ${id} ${publishedAt}${suffix}`);
};

export const LoggingProjection = {
  create: (logger: EventLogger = defaultLogger): ProjectionFunction<SourceEvent> => {
    return serialize((event: PublishedEvent) => logger(event));
  },
  wrap: (
    name: string,
    projection: ProjectionFunction,
    logger: EventLogger = defaultLogger
  ): ProjectionFunction => {
    return serialize(async (event: PublishedEvent) => {
      logger(event, "starting projection", name);
      await projection(event);
      logger(event, "completed projection", name);
    });
  },
};
