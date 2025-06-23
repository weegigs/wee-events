import { DomainEvent } from "@weegigs/events-core";
import { Receipt } from "../types";
import { ItemAdded, ItemRemoved, ReceiptFinalized, ReceiptVoided } from "./types";

// Helper function to calculate total from items
const calculateTotal = (items: Receipt['items']): number => {
  return items.reduce((total, item) => total + (item.price * item.quantity), 0);
};

// Event reducer functions
export const itemAddedReducer = (
  state: Receipt, 
  event: DomainEvent<"item-added", ItemAdded.Type>
): Receipt => {
  const newItems = [...state.items, { 
    name: event.data.name, 
    price: event.data.price, 
    quantity: event.data.quantity 
  }];
  
  return {
    ...state,
    items: newItems,
    total: calculateTotal(newItems)
  };
};

export const itemRemovedReducer = (
  state: Receipt, 
  event: DomainEvent<"item-removed", ItemRemoved.Type>
): Receipt => {
  const newItems = state.items.filter(item => item.name !== event.data.name);
  
  return {
    ...state,
    items: newItems,
    total: calculateTotal(newItems)
  };
};

export const receiptFinalizedReducer = (
  state: Receipt, 
  _event: DomainEvent<"receipt-finalized", ReceiptFinalized.Type>
): Receipt => ({
  ...state,
  status: "closed"
});

export const receiptVoidedReducer = (
  state: Receipt, 
  _event: DomainEvent<"receipt-voided", ReceiptVoided.Type>
): Receipt => ({
  ...state,
  status: "voided"
});