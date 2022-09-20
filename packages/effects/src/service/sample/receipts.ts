import * as z from "zod";
import * as open from "@asteasolutions/zod-to-openapi";

import * as T from "@effect-ts/core/Effect";
import { pipe } from "@effect-ts/core/Function";

import * as wee from "@weegigs/events-core";

import * as dsptchr from "../dispatcher";
import * as ldr from "../loader";
import * as srvc from "../service";
import * as es from "../../event-store";

open.extendZodWithOpenApi(z);

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
export const Added = z.object({ amount: z.number().int().min(1) });
export type Added = z.TypeOf<typeof Added>;
const addedReducer: ldr.Reducer<Receipt, "added", Added> = (state, event) => ({
  ...state,
  total: state.total + event.data.amount,
});

export const Deducted = z.object({ amount: z.number().int().min(1) });
export type Deducted = z.TypeOf<typeof Deducted>;
const deductedReducer: ldr.Reducer<Receipt, "deducted", Deducted> = (state, event) => ({
  ...state,
  total: state.total - event.data.amount,
});

const loader = ldr.EntityLoader.init("receipt", (id): Receipt => ({ id: `${id.type}.${id.key}`, total: 0 }))
  .reducer("added", Added, addedReducer)
  .reducer("deducted", Deducted, deductedReducer);

// const simple = loader.EntityLoader.init<Receipt>("receipt", () => ({ total: 0 }))
//   .reducer("added", Added, addedReducer)
//   .reducer("deducted", Deducted, deductedReducer);

// commands

const done = () => T.unit;
const finished = T.map(() => void 0);

export const Add = z.object({ amount: z.number().int().min(1) }).openapi({
  description: "Add money to the receipt",
});
export type Add = z.TypeOf<typeof Add>;
const addHandler = (entity: wee.Entity<Receipt>, command: Add) =>
  T.chain_(es.publish(entity.aggregate, { type: "added", data: { amount: command.amount } }), done);

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
  pipe(
    T.do,
    T.bind("event", () =>
      T.suspend(() => {
        if (entity.state.total - command.amount < 0) {
          return T.fail(new InsufficientBalanceError(command.amount, entity.state.total));
        }

        return T.succeed({ type: "deducted", data: { amount: command.amount } });
      })
    ),
    T.bind("_", ({ event }) => es.publish(entity.aggregate, event, { expectedRevision: entity.revision })),
    finished
  );

const dispatcher = dsptchr.Dispatcher.create<Receipt>()
  .handler("add", Add, addHandler)
  .handler("deduct", Deduct, deductHandler);

export const description = srvc.description(
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
