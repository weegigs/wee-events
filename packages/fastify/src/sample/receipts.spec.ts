import { description, receiptErrorMapper } from "./receipts";
import { MemoryStore } from "@weegigs/events-core/lib";
import { create } from "../server";
import { AddItem, RemoveItem, Finalize, VoidReceipt } from "./commands/types";
import { ItemAdded, ItemRemoved, ReceiptFinalized, ReceiptVoided } from "./events/types";

describe("receipts sample", () => {
  it("should create a valid service description", () => {
    const info = description.info();
    expect(info.title).toBe("Receipt Service");
    expect(info.description).toBe("A sample receipt management service demonstrating event sourcing patterns with modular architecture");
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

  it("should create a fastify server factory", () => {
    const store = new MemoryStore();
    const serverFactory = create(description, receiptErrorMapper);
    const server = serverFactory(store, {});
    
    expect(server).toBeDefined();
    expect(typeof server.listen).toBe("function");
  });

  it("should start with an open receipt with zero total", async () => {
    const store = new MemoryStore();
    const serverFactory = create(description, receiptErrorMapper);
    const server = serverFactory(store, {});
    
    const response = await server.inject({
      method: "GET",
      url: "/receipt/test-receipt"
    });
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.state.status).toBe("open");
    expect(body.state.total).toBe(0);
    expect(body.state.items).toEqual([]);
    expect(body.state.id).toBe("test-receipt");
  });

  it("should calculate total correctly when adding items", async () => {
    const store = new MemoryStore();
    const serverFactory = create(description, receiptErrorMapper);
    const server = serverFactory(store, {});
    
    const response = await server.inject({
      method: "POST",
      url: "/receipt/test-receipt/add-item",
      payload: { name: "Coffee", price: 5.99, quantity: 2 }
    });
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.state.total).toBe(11.98);
    expect(body.state.items).toHaveLength(1);
    expect(body.state.status).toBe("open");
  });

  it("should close receipt when finalized", async () => {
    const store = new MemoryStore();
    const serverFactory = create(description, receiptErrorMapper);
    const server = serverFactory(store, {});
    
    // Add an item first
    await server.inject({
      method: "POST", 
      url: "/receipt/test-receipt/add-item",
      payload: { name: "Coffee", price: 5.99, quantity: 1 }
    });
    
    // Then finalize
    const response = await server.inject({
      method: "POST",
      url: "/receipt/test-receipt/finalize",
      payload: {}
    });
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.state.status).toBe("closed");
  });

  it("should void receipt and set status to voided", async () => {
    const store = new MemoryStore();
    const serverFactory = create(description, receiptErrorMapper);
    const server = serverFactory(store, {});
    
    // Add an item first
    await server.inject({
      method: "POST",
      url: "/receipt/test-receipt/add-item", 
      payload: { name: "Coffee", price: 5.99, quantity: 1 }
    });
    
    // Then void the receipt
    const response = await server.inject({
      method: "POST",
      url: "/receipt/test-receipt/void-receipt",
      payload: { reason: "Customer changed mind" }
    });
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.state.status).toBe("voided");
  });

  it("should reject operations on closed receipts", async () => {
    const store = new MemoryStore();
    const serverFactory = create(description, receiptErrorMapper);
    const server = serverFactory(store, {});
    
    // Add item and finalize receipt
    await server.inject({
      method: "POST",
      url: "/receipt/test-receipt/add-item",
      payload: { name: "Coffee", price: 5.99, quantity: 1 }
    });
    
    await server.inject({
      method: "POST",
      url: "/receipt/test-receipt/finalize",
      payload: {}
    });
    
    // Try to add another item to closed receipt
    const response = await server.inject({
      method: "POST",
      url: "/receipt/test-receipt/add-item",
      payload: { name: "Tea", price: 3.99, quantity: 1 }
    });
    
    expect(response.statusCode).toBe(400);
  });

  it("should reject operations on voided receipts", async () => {
    const store = new MemoryStore();
    const serverFactory = create(description, receiptErrorMapper);
    const server = serverFactory(store, {});
    
    // Add item and void receipt
    await server.inject({
      method: "POST",
      url: "/receipt/test-receipt/add-item",
      payload: { name: "Coffee", price: 5.99, quantity: 1 }
    });
    
    await server.inject({
      method: "POST",
      url: "/receipt/test-receipt/void-receipt",
      payload: { reason: "Test void" }
    });
    
    // Try to add another item to voided receipt
    const response = await server.inject({
      method: "POST",
      url: "/receipt/test-receipt/add-item",
      payload: { name: "Tea", price: 3.99, quantity: 1 }
    });
    
    expect(response.statusCode).toBe(400);
  });

  it("should return 400 when trying to remove non-existent item", async () => {
    const store = new MemoryStore();
    const serverFactory = create(description, receiptErrorMapper);
    const server = serverFactory(store, {});
    
    // Try to remove an item that doesn't exist
    const response = await server.inject({
      method: "POST",
      url: "/receipt/test-receipt/remove-item",
      payload: { name: "NonExistentItem" }
    });
    
    expect(response.statusCode).toBe(400);
  });

  it("should return 400 when trying to finalize empty receipt", async () => {
    const store = new MemoryStore();
    const serverFactory = create(description, receiptErrorMapper);
    const server = serverFactory(store, {});
    
    // Try to finalize an empty receipt
    const response = await server.inject({
      method: "POST",
      url: "/receipt/test-receipt/finalize",
      payload: {}
    });
    
    expect(response.statusCode).toBe(400);
  });

  it("should return 400 when trying to void already voided receipt", async () => {
    const store = new MemoryStore();
    const serverFactory = create(description, receiptErrorMapper);
    const server = serverFactory(store, {});
    
    // Add item and void receipt
    await server.inject({
      method: "POST",
      url: "/receipt/test-receipt/add-item",
      payload: { name: "Coffee", price: 5.99, quantity: 1 }
    });
    
    await server.inject({
      method: "POST",
      url: "/receipt/test-receipt/void-receipt",
      payload: { reason: "First void" }
    });
    
    // Try to void the already voided receipt
    const response = await server.inject({
      method: "POST",
      url: "/receipt/test-receipt/void-receipt",
      payload: { reason: "Second void attempt" }
    });
    
    expect(response.statusCode).toBe(400);
  });
});