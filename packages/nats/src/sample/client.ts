import { NatsClient } from "../client";
import { description } from "@weegigs/events-fastify/src/sample/receipts";

async function runClient() {
  const natsUrl = process.env.NATS_URL || "nats://localhost:4222";
  const client = await NatsClient.create(description).connect(natsUrl);

  try {
    console.log(`Connected to NATS ${natsUrl}`);

    // Create a receipt
    const receiptKey = `receipt-${Date.now()}`;
    const receiptId = { type: "receipt", key: receiptKey };
    console.log(`\n=== Creating receipt: ${receiptKey} ===`);

    // Add items
    console.log("Adding coffee...");
    await client.execute("add-item", receiptId, {
      name: "Coffee",
      price: 4.5,
      quantity: 2,
    });

    console.log("Adding muffin...");
    await client.execute("add-item", receiptId, {
      name: "Blueberry Muffin",
      price: 3.25,
      quantity: 1,
    });

    // Fetch current state
    const receipt1 = await client.fetch(receiptId);
    console.log("Current receipt:", JSON.stringify(receipt1.state, null, 2));

    // Remove an item
    console.log("\nRemoving coffee...");
    await client.execute("remove-item", receiptId, {
      name: "Coffee",
    });

    // Check state again
    const receipt2 = await client.fetch(receiptId);
    console.log("Receipt after removal:", JSON.stringify(receipt2.state, null, 2));

    // Finalize the receipt
    console.log("\nFinalizing receipt...");
    await client.execute("finalize", receiptId, {});

    // Final state
    const finalReceipt = await client.fetch(receiptId);
    console.log("Final receipt:", JSON.stringify(finalReceipt.state, null, 2));

    console.log("\n=== Done ===");
  } catch (error) {
    console.error("Client error:", error);
  } finally {
    await client.close();
    console.log("\nDisconnected from NATS");
  }
}

runClient().catch((err) => {
  console.error("Failed to run client:", err);
  process.exit(1);
});
