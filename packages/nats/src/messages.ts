import { Payload, Revision } from "@weegigs/events-core";
import { z } from "zod";

export namespace ExecuteRequest {
  export const schema = z
    .object({
      target: z
        .object({
          type: z.string(),
          key: z.string(),
        })
        .strict(),
      command: z.string().min(1),
      payload: Payload.schema,
      metadata: z.record(z.unknown()).default({}),
    })
    .strict();

  export type Type = z.infer<typeof schema>;
}

export namespace ExecuteResponse {
  export const schema = z
    .object({
      entity: z.object({
        aggregate: z
          .object({
            type: z.string(),
            key: z.string(),
          })
          .strict(),
        type: z.string().min(1),
        revision: Revision.schema,
        state: z.any(),
      }),
      metadata: z.record(z.unknown()).default({}),
    })
    .strict();

  export type Type = z.infer<typeof schema>;
}

export namespace FetchRequest {
  export const schema = z
    .object({
      aggregateId: z
        .object({
          type: z.string(),
          key: z.string(),
        })
        .strict(),
    })
    .strict();

  export type Type = z.infer<typeof schema>;
}

export namespace FetchResponse {
  export const schema = z
    .object({
      entity: z.object({
        aggregate: z
          .object({
            type: z.string(),
            key: z.string(),
          })
          .strict(),
        type: z.string().min(1),
        revision: Revision.schema,
        state: z.any(),
      }),
    })
    .strict();

  export type Type = z.infer<typeof schema>;
}
