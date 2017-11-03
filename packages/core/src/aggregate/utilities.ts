import { AggregateId } from "./types";

export function aggregateKey(id: AggregateId): string {
  return `${id.type}:${id.id}`;
}
