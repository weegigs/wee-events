import * as z from "zod";

import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { Effect } from "effect";
import { pipe } from "effect";
import * as wee from "@weegigs/events-core";

import * as s from "../../event-store";
import * as d from "../dispatcher";
import * as l from "../loader";
import * as srv from "../service";

extendZodWithOpenApi(z);

export const Receipt = z
  .object({
    id: z.string().min(0),
    total: z.number().int().min(0),
  })
  .openapi({
    description: "A receipt",
  });
export type Receipt = z.infer<typeof Receipt>;

// events
export namespace Added {
  export const schema = z.object({ amount: z.number().int().min(1) });
  export const reducer: wee.Reducer<Receipt, wee.DomainEvent<"added", Added>> = (state, event) => ({
    ...state,
    total: state.total + event.data.amount,
  });
}
export type Added = z.TypeOf<typeof Added.schema>;

export namespace Deducted {
  export const schema = z.object({ amount: z.number().int().min(1) });
  export const reducer: wee.Reducer<Receipt, wee.DomainEvent<"deducted", Deducted>> = (state, event) => ({
    ...state,
    total: state.total - event.data.amount,
  });
}
export type Deducted = z.TypeOf<typeof Deducted.schema>;

const loader = l.EntityLoader.init("receipt", (id: wee.AggregateId): Receipt => ({ id: `${id.type}.${id.key}`, total: 0 }))
  .reducer("added", Added.schema, Added.reducer)
  .reducer("deducted", Deducted.schema, Deducted.reducer);

// commands

export const Add = z.object({ amount: z.number().int().min(1) }).openapi({
  description: "Add money to the receipt",
});
export type Add = z.TypeOf<typeof Add>;

const addHandler = (entity: wee.Entity<Receipt>, command: Add) =>
  pipe(
    s.publish(entity.aggregate, { type: "added", data: { amount: command.amount } }),
    Effect.map(() => void 0)
  );

export class InsufficientBalanceError extends Error {
  constructor(public readonly requested: number, public readonly balance: number) {
    super("insufficient balance available");
    this.name = "InsufficientBalanceError";

    Object.setPrototypeOf(this, InsufficientBalanceError.prototype);
  }
}

export const Deduct = z.object({ amount: z.number().int().min(1) }).openapi({
  description: "Deduct money from the receipt",
});
export type Deduct = z.TypeOf<typeof Deduct>;

const deductHandler = (entity: wee.Entity<Receipt>, command: Deduct) =>
  Effect.gen(function* () {
    const event = yield* Effect.suspend(() => {
      if (entity.state.total - command.amount < 0) {
        return Effect.fail(new InsufficientBalanceError(command.amount, entity.state.total));
      }

      return Effect.succeed({ type: "deducted", data: { amount: command.amount } } as const);
    });
    
    yield* s.publish(entity.aggregate, event, { expectedRevision: entity.revision });
    return void 0;
  });

const dispatcher = d.Dispatcher.create<Receipt>()
  .handler("add", Add, addHandler)
  .handler("deduct", Deduct, deductHandler);

export const description = srv.description(
  {
    version: "1.0.0",
    title: "A Sample Receipt Service",
    description: "A sample service for managing receipts",
    entity: { name: "receipt", schema: Receipt },
  },
  dispatcher,
  loader.make()
);

export const service = description.service();