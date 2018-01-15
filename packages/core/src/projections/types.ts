import { EventId, PublishedEvent } from "../types";

export type ProjectionPosition = EventId | undefined;
export type ProjectionFunction<T = any> = (event: PublishedEvent<T>) => void | Promise<void>;

export type RepresentationFunction = <T>(events: PublishedEvent[], seed?: T) => Promise<T>;
