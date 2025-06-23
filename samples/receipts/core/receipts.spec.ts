import { describe, it, expect } from "vitest";
import { description, receiptErrorMapper } from "./receipts";
import { AddItem, RemoveItem, Finalize, VoidReceipt } from "./commands/types";
import { ItemAdded, ItemRemoved, ReceiptFinalized, ReceiptVoided } from "./events/types";

describe("receipts sample", () => {
  it("should create a valid service description", () => {
    const info = description.info();
    expect(info.title).toBe("Receipt Service");
    expect(info.description).toBe(
      "A sample receipt management service demonstrating event sourcing patterns with modular architecture"
    );
    expect(info.version).toBe("1.0.0");
  });

  it("should have proper command handlers", () => {
    const commandNames = Object.keys(description.commands());
    expect(commandNames).toContain(AddItem.name);
    expect(commandNames).toContain(RemoveItem.name);
    expect(commandNames).toContain(Finalize.name);
    expect(commandNames).toContain(VoidReceipt.name);
  });

  it("should have proper event reducers", () => {
    const eventTypes = Object.keys(description.events());
    expect(eventTypes).toContain(ItemAdded.name);
    expect(eventTypes).toContain(ItemRemoved.name);
    expect(eventTypes).toContain(ReceiptFinalized.name);
    expect(eventTypes).toContain(ReceiptVoided.name);
  });

  it("should export error mapper function", () => {
    expect(typeof receiptErrorMapper).toBe("function");
  });
});