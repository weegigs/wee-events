import { z } from "zod";

// Event type definitions
export namespace ItemAdded {
  export const name = "item-added" as const;
  export const schema = z.object({ 
    name: z.string(),
    price: z.number(),
    quantity: z.number(),
    lineTotal: z.number()
  });
  export type Type = z.infer<typeof schema>;
}

export namespace ItemRemoved {
  export const name = "item-removed" as const;
  export const schema = z.object({ 
    name: z.string(),
    refundAmount: z.number()
  });
  export type Type = z.infer<typeof schema>;
}

export namespace ReceiptFinalized {
  export const name = "receipt-finalized" as const;
  export const schema = z.object({ 
    finalTotal: z.number(),
    itemCount: z.number()
  });
  export type Type = z.infer<typeof schema>;
}

export namespace ReceiptVoided {
  export const name = "receipt-voided" as const;
  export const schema = z.object({ 
    reason: z.string(),
    voidedTotal: z.number()
  });
  export type Type = z.infer<typeof schema>;
}