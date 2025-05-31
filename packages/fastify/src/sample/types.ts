import { z } from "zod";
import { AggregateId } from "@weegigs/events-core/lib";

// Receipt status enum
export const ReceiptStatus = z.enum(["open", "closed", "voided"]);
export type ReceiptStatus = z.infer<typeof ReceiptStatus>;

// Receipt item definition
export namespace ReceiptItem {
  export const schema = z.object({
    name: z.string(),
    price: z.number().min(0),
    quantity: z.number().int().min(1)
  });
}
export type ReceiptItem = z.infer<typeof ReceiptItem.schema>;

// Receipt entity definition
export namespace Receipt {
  export const schema = z.object({
    id: z.string(),
    status: ReceiptStatus,
    items: z.array(ReceiptItem.schema),
    total: z.number().min(0)
  });

  export const create = (aggregate: AggregateId): Receipt => ({
    id: aggregate.key,
    status: "open",
    items: [],
    total: 0
  });
}

export type Receipt = z.infer<typeof Receipt.schema>;