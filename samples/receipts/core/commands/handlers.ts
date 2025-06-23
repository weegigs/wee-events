import { Entity, Publisher } from "@weegigs/events-core";
import { Receipt } from "../types";
import { AddItem, RemoveItem, Finalize, VoidReceipt } from "./types";
import { ItemAdded, ItemRemoved, ReceiptFinalized, ReceiptVoided } from "../events/types";
import { 
  InvalidReceiptStateError, 
  ItemNotFoundError, 
  ReceiptAlreadyVoidedError, 
  EmptyReceiptError 
} from "../errors";

// Helper function to check if receipt is open
const ensureReceiptIsOpen = (entity: Entity<Receipt>, operation: string): void => {
  if (entity.state.status !== "open") {
    throw new InvalidReceiptStateError(operation, entity.state.status);
  }
};

// Command handler functions
export const addItemHandler = async (
  environment: Publisher, 
  entity: Entity<Receipt>, 
  command: AddItem.Type
): Promise<void> => {
  ensureReceiptIsOpen(entity, "add-item");
  
  const { publish } = environment;
  await publish(entity.aggregate, { 
    type: ItemAdded.name, 
    data: { 
      name: command.name,
      price: command.price,
      quantity: command.quantity,
      lineTotal: command.price * command.quantity
    } 
  });
};

export const removeItemHandler = async (
  environment: Publisher, 
  entity: Entity<Receipt>, 
  command: RemoveItem.Type
): Promise<void> => {
  ensureReceiptIsOpen(entity, "remove-item");
  
  const { publish } = environment;
  const item = entity.state.items.find(i => i.name === command.name);
  if (!item) {
    throw new ItemNotFoundError(command.name);
  }
  await publish(entity.aggregate, { 
    type: ItemRemoved.name, 
    data: { 
      name: command.name,
      refundAmount: item.price * item.quantity
    } 
  });
};

export const finalizeHandler = async (
  environment: Publisher, 
  entity: Entity<Receipt>, 
  _command: Finalize.Type
): Promise<void> => {
  ensureReceiptIsOpen(entity, "finalize");
  
  const { publish } = environment;
  if (entity.state.items.length === 0) {
    throw new EmptyReceiptError();
  }
  await publish(entity.aggregate, { 
    type: ReceiptFinalized.name, 
    data: { 
      finalTotal: entity.state.total,
      itemCount: entity.state.items.length
    } 
  });
};

export const voidReceiptHandler = async (
  environment: Publisher, 
  entity: Entity<Receipt>, 
  command: VoidReceipt.Type
): Promise<void> => {
  if (entity.state.status === "voided") {
    throw new ReceiptAlreadyVoidedError();
  }
  
  const { publish } = environment;
  await publish(entity.aggregate, { 
    type: ReceiptVoided.name, 
    data: { 
      reason: command.reason,
      voidedTotal: entity.state.total
    } 
  });
};