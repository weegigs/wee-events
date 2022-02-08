import { AggregateId } from "@weegigs/events-core";

export type KeySource = (id: AggregateId) => Promise<Buffer>;
