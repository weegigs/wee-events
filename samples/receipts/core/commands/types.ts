import { z } from "zod";

// Command type definitions
export namespace AddItem {
  export const name = "add-item" as const;
  export const schema = z.object({ 
    name: z.string().openapi({
      description: "Item name or description",
      example: "Coffee"
    }),
    price: z.number().min(0).openapi({
      description: "Unit price in dollars",
      example: 5.99
    }),
    quantity: z.number().int().min(1).openapi({
      description: "Quantity to add to receipt", 
      example: 2
    })
  }).openapi({
    title: "AddItemCommand",
    description: "Add an item to an open receipt"
  });
  export type Type = z.infer<typeof schema>;
}

export namespace RemoveItem {
  export const name = "remove-item" as const;
  export const schema = z.object({ 
    name: z.string().openapi({
      description: "Name of the item to remove",
      example: "Coffee"
    })
  }).openapi({
    title: "RemoveItemCommand", 
    description: "Remove an item from an open receipt"
  });
  export type Type = z.infer<typeof schema>;
}

export namespace Finalize {
  export const name = "finalize" as const;
  export const schema = z.object({}).openapi({
    title: "FinalizeCommand",
    description: "Close the receipt and prevent further modifications"
  });
  export type Type = z.infer<typeof schema>;
}

export namespace VoidReceipt {
  export const name = "void-receipt" as const;
  export const schema = z.object({ 
    reason: z.string().openapi({
      description: "Reason for voiding the receipt",
      example: "Customer changed mind"
    })
  }).openapi({
    title: "VoidReceiptCommand",
    description: "Cancel the receipt and prevent further operations"
  });
  export type Type = z.infer<typeof schema>;
}