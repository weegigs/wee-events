import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { AggregateId } from "@weegigs/events-core/lib";

// Enable OpenAPI extensions for Zod
extendZodWithOpenApi(z);

// Receipt status enum
export const ReceiptStatus = z.enum(["open", "closed", "voided"]).openapi({
  description: "Receipt status in the workflow",
  example: "open"
});
export type ReceiptStatus = z.infer<typeof ReceiptStatus>;

// Receipt item definition
export namespace ReceiptItem {
  export const schema = z.object({
    name: z.string().openapi({
      description: "Item name or description",
      example: "Coffee"
    }),
    price: z.number().min(0).openapi({
      description: "Unit price in dollars (see documentation note about decimal precision)",
      example: 5.99
    }),
    quantity: z.number().int().min(1).openapi({
      description: "Quantity of items",
      example: 2
    })
  }).openapi({
    title: "ReceiptItem",
    description: "An item on a receipt with price and quantity"
  });
}
export type ReceiptItem = z.infer<typeof ReceiptItem.schema>;

// Receipt entity definition
export namespace Receipt {
  export const schema = z.object({
    id: z.string().openapi({
      description: "Unique receipt identifier",
      example: "order-12345"
    }),
    status: ReceiptStatus,
    items: z.array(ReceiptItem.schema).openapi({
      description: "List of items on the receipt"
    }),
    total: z.number().min(0).openapi({
      description: "Total amount calculated from all items",
      example: 23.97
    })
  }).openapi({
    title: "Receipt",
    description: "A receipt representing a collection of purchased items"
  });

  export const create = (aggregate: AggregateId): Receipt => ({
    id: aggregate.key,
    status: "open",
    items: [],
    total: 0
  });
}

export type Receipt = z.infer<typeof Receipt.schema>;