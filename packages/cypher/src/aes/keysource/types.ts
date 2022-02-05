import { AggregateId } from "@weegigs/wee-events";

export type KeySource = (id: AggregateId) => Promise<Buffer>;
