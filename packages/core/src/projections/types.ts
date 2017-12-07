import { EventId, PublishedEvent } from "../types";
import { AggregateId } from "../aggregate";

export type ProjectionPosition = EventId | undefined;
export type ProjectionFunction<T = any> = (event: PublishedEvent<T>) => void | Promise<void>;

export type RepresentationFunction = <T>(id: AggregateId) => Promise<T>;
