import { z } from "zod";

// Command type definitions
export namespace AddItem {
  export const name = "add-item" as const;
  export const schema = z.object({ 
    name: z.string(),
    price: z.number().min(0),
    quantity: z.number().int().min(1)
  });
  export type Type = z.infer<typeof schema>;
}

export namespace RemoveItem {
  export const name = "remove-item" as const;
  export const schema = z.object({ 
    name: z.string() 
  });
  export type Type = z.infer<typeof schema>;
}

export namespace Finalize {
  export const name = "finalize" as const;
  export const schema = z.object({});
  export type Type = z.infer<typeof schema>;
}

export namespace VoidReceipt {
  export const name = "void-receipt" as const;
  export const schema = z.object({ 
    reason: z.string()
  });
  export type Type = z.infer<typeof schema>;
}