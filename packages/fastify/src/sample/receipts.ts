// This file is a sample and needs to be updated for the new Effect-TS migration
// Commented out to avoid compilation errors during migration

/*
import * as z from "zod";

import * as open from "@asteasolutions/zod-to-openapi";
import * as T from "@effect-ts/core/Effect";
import { pipe } from "@effect-ts/core/Function";
import * as wee from "@weegigs/events-core";

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

// TODO: Update this sample file to use the new Effect-TS v3.x API
// after the migration is complete

export const description = undefined;
export const service = undefined;
*/