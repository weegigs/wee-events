import { AggregateId } from "@weegigs/events-core";

export function aggregateFilter(id: AggregateId) {
  return { "id.id": id.id, "id.type": id.type };
}
