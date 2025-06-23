import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import path from "path";

describe("Docker Container Integration", () => {
  let container: StartedTestContainer;
  let baseUrl: string;

  beforeAll(async () => {
    // The build context is the root of the monorepo
    // Navigate up from the current package to the repository root
    const buildContext = path.resolve(__dirname, "../../../");

    // The Dockerfile is located at the root of the build context.
    const dockerfilePath = "Dockerfile"; // Relative path from context

    // Build the image targeting the receipt-http-sample stage
    const builtImage = await GenericContainer.fromDockerfile(buildContext, dockerfilePath)
      .withTarget("receipt-http-sample")
      .build();

    // Then create container from the built image
    container = await builtImage
      .withExposedPorts(3000)
      .withWaitStrategy(Wait.forHttp("/healthz", 3000))
      .withStartupTimeout(300000) // 5 minutes for startup
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(3000);
    baseUrl = `http://${host}:${port}`;
  }, 600000); // 10 minutes timeout for container startup

  afterAll(async () => {
    if (container) {
      await container.stop();
    }
  });

  it("should respond to health check", async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as { status: string; timestamp: string };
    expect(body.status).toBe("healthy");
    expect(body.timestamp).toBeDefined();
  });

  it("should serve OpenAPI documentation", async () => {
    const response = await fetch(`${baseUrl}/openapi`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/text\/html/);
  });

  it("should serve OpenAPI schema", async () => {
    const response = await fetch(`${baseUrl}/openapi/schema.json`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/application\/json/);

    const schema = (await response.json()) as {
      openapi: string;
      info: unknown;
      paths: Record<string, unknown>;
    };
    expect(schema.openapi).toBe("3.1.0");
    expect(schema.info).toBeDefined();
    expect(schema.paths).toBeDefined();

    // Check that receipt endpoints are documented
    expect(schema.paths["/receipt/{id}"]).toBeDefined();
    expect(schema.paths["/receipt/{id}/add-item"]).toBeDefined();
    expect(schema.paths["/receipt/{id}/remove-item"]).toBeDefined();
    expect(schema.paths["/receipt/{id}/finalize"]).toBeDefined();
    expect(schema.paths["/receipt/{id}/void-receipt"]).toBeDefined();
  });

  it("should handle receipt operations", async () => {
    const receiptId = "test-receipt-" + Date.now();

    // Get initial state (should create empty receipt)
    const getResponse = await fetch(`${baseUrl}/receipt/${receiptId}`);
    expect(getResponse.status).toBe(200);

    const initialState = (await getResponse.json()) as {
      state: { status: string; total: number; items: unknown[] };
    };
    expect(initialState.state.status).toBe("open");
    expect(initialState.state.total).toBe(0);
    expect(initialState.state.items).toEqual([]);

    // Add an item
    const addResponse = await fetch(`${baseUrl}/receipt/${receiptId}/add-item`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Coffee",
        price: 4.99,
        quantity: 2,
      }),
    });

    expect(addResponse.status).toBe(200);
    const addedState = (await addResponse.json()) as {
      state: {
        total: number;
        items: Array<{ name: string; price: number; quantity: number }>;
      };
    };
    expect(addedState.state.total).toBe(9.98);
    expect(addedState.state.items).toHaveLength(1);
    expect(addedState.state.items[0].name).toBe("Test Coffee");

    // Finalize receipt
    const finalizeResponse = await fetch(`${baseUrl}/receipt/${receiptId}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(finalizeResponse.status).toBe(200);
    const finalizedState = (await finalizeResponse.json()) as {
      state: { status: string };
    };
    expect(finalizedState.state.status).toBe("closed");
  });

  it("should handle business rule violations", async () => {
    const receiptId = "error-test-" + Date.now();

    // Try to finalize empty receipt (should fail)
    const response = await fetch(`${baseUrl}/receipt/${receiptId}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  it("should handle invalid requests", async () => {
    const receiptId = "invalid-test-" + Date.now();

    // Send invalid item data
    const response = await fetch(`${baseUrl}/receipt/${receiptId}/add-item`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Item",
        // Missing required fields: price, quantity
      }),
    });

    expect(response.status).toBe(400);
  });
});
