import { AggregateId } from "./types";

export function aggregateKey(id: AggregateId): string {
  return `${id.type}:${id.id}`;
}

export function aggregateId(type: string, id: string): AggregateId {
  return { type, id };
}
