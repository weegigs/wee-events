import { 
  DispatcherDescription,
  LoaderDescription, 
  ServiceDescription
} from "@weegigs/events-core";
import errors from "http-errors";

// Import types
import { Receipt } from "./types";
import { BusinessRuleViolationError } from "./errors";

// Import event definitions and reducers
import { ItemAdded, ItemRemoved, ReceiptFinalized, ReceiptVoided } from "./events/types";
import { itemAddedReducer, itemRemovedReducer, receiptFinalizedReducer, receiptVoidedReducer } from "./events/reducers";

// Import command definitions and handlers
import { AddItem, RemoveItem, Finalize, VoidReceipt } from "./commands/types";
import { addItemHandler, removeItemHandler, finalizeHandler, voidReceiptHandler } from "./commands/handlers";

// Event reducers and loader configuration
const loader = LoaderDescription.fromInitFunction<Receipt>(
  { type: "receipt", schema: Receipt.schema },
  Receipt.create
)
  .reducer(ItemAdded.name, ItemAdded.schema, itemAddedReducer)
  .reducer(ItemRemoved.name, ItemRemoved.schema, itemRemovedReducer)
  .reducer(ReceiptFinalized.name, ReceiptFinalized.schema, receiptFinalizedReducer)
  .reducer(ReceiptVoided.name, ReceiptVoided.schema, receiptVoidedReducer)
  .description();

// Command dispatcher configuration
const dispatcher = DispatcherDescription.handler(AddItem.name, AddItem.schema, addItemHandler)
  .handler(RemoveItem.name, RemoveItem.schema, removeItemHandler)
  .handler(Finalize.name, Finalize.schema, finalizeHandler)
  .handler(VoidReceipt.name, VoidReceipt.schema, voidReceiptHandler)
  .description();

// Service description - main configuration and wiring
export const description = ServiceDescription.create(
  { 
    title: "Receipt Service", 
    description: "A sample receipt management service demonstrating event sourcing patterns with modular architecture", 
    version: "1.0.0" 
  },
  loader,
  dispatcher
);

// Custom error mapper for business rule violations
export const receiptErrorMapper = (error: unknown): errors.HttpError => {
  if (error instanceof BusinessRuleViolationError) {
    return new errors.BadRequest(error.message);
  }
  
  // Default to 500 for other errors
  return new errors.InternalServerError(error instanceof Error ? error.message : `${error}`);
};

// Re-export types for external consumers
export type { Receipt, ReceiptStatus, ReceiptItem } from "./types";
export type { AddItem, RemoveItem, Finalize, VoidReceipt } from "./commands/types";
export type { ItemAdded, ItemRemoved, ReceiptFinalized, ReceiptVoided } from "./events/types";