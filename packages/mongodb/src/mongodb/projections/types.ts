import { AggregateId } from "@weegigs/events-core";

export interface ProjectionMetadata {
  name: string;
  position?: string;
}

export interface ProjectionDocument<T> {
  id: AggregateId;
  version: string;
  content: T;
}
