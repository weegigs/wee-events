import { describe, it, expect, vi } from "vitest";
import { NatsService } from "./nats-service";
import { MemoryStore } from "@weegigs/events-core";
import * as events from "@weegigs/events-core";

// Mock NATS dependencies
vi.mock("@nats-io/nats-core", () => ({
  syncIterator: vi.fn(() => ({
    next: vi.fn().mockResolvedValue(null), // Iterator immediately returns null (closed)
  })),
}));

vi.mock("@nats-io/services", () => ({
  Svcm: vi.fn(),
}));

// Create a minimal service description for testing
const createTestDescription = () => {
  const info = {
    entity: { type: "test-service" },
    version: "1.0.0",
    description: "Test service",
  };

  const commands = {
    "test-command": {},
  };

  return {
    info: () => info,
    commands: () => commands,
    service: (_store: events.EventStore, _env: unknown) => ({
      load: vi.fn(),
      execute: vi.fn(),
    }),
  };
};

describe("NatsService", () => {
  describe("Deferred shutdown signal implementation", () => {
    it("should create shutdown signal with proper type", async () => {
      // This is more of a compilation test to ensure types are correct
      const description = createTestDescription();
      const mockNats = {
        addGroup: vi.fn().mockReturnValue({
          addGroup: vi.fn().mockReturnValue({
            addEndpoint: vi.fn().mockReturnValue({}), // Return empty iterator object
          }),
          addEndpoint: vi.fn(),
        }),
        stop: vi.fn(),
      };
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new (NatsService as any)(
        description,
        mockNats,
        new MemoryStore(),
        {}
      );

      // Wait for iterator processor to complete (should be immediate with mocked null)
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(service).toBeDefined();
      expect(service.shutdownSignal).toBeDefined();
    });

    it("should resolve shutdown signal with null", async () => {
      const description = createTestDescription();
      const mockNats = {
        addGroup: vi.fn().mockReturnValue({
          addGroup: vi.fn().mockReturnValue({
            addEndpoint: vi.fn().mockReturnValue({}), // Return empty iterator object
          }),
          addEndpoint: vi.fn(),
        }),
        stop: vi.fn().mockResolvedValue(undefined),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new (NatsService as any)(
        description,
        mockNats,
        new MemoryStore(),
        {}
      );

      // Wait for iterator processor to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Access private shutdown signal for testing
      const shutdownSignal = service.shutdownSignal;
      expect(shutdownSignal.promise).toBeInstanceOf(Promise);

      // Trigger shutdown
      const shutdownPromise = service.shutdown();

      // Verify shutdown signal resolves to null
      const signalResult = await shutdownSignal.promise;
      expect(signalResult).toBeNull();

      await shutdownPromise;
    });
  });

  describe("Iterator processor simulation", () => {
    it("should demonstrate Promise.race pattern", async () => {
      // Simulate the iterator.next() vs shutdown signal race
      let resolveShutdown: (value: null) => void = () => {};
      const shutdownSignal = new Promise<null>(resolve => {
        resolveShutdown = resolve;
      });

      const iteratorNext = new Promise<string>(() => {
        // Never resolves in this test
      });

      // Race the promises
      const racePromise = Promise.race([iteratorNext, shutdownSignal]);

      // Resolve shutdown signal first
      resolveShutdown(null);

      const result = await racePromise;
      expect(result).toBeNull();
    });

    it("should handle iterator message before shutdown", async () => {
      // Simulate the iterator.next() vs shutdown signal race
      const shutdownSignal = new Promise<null>(() => {
        // Never resolves in this test
      });

      let resolveIterator: (value: { data: string }) => void = () => {};
      const iteratorNext = new Promise<{ data: string }>(resolve => {
        resolveIterator = resolve;
      });

      // Race the promises
      const racePromise = Promise.race([iteratorNext, shutdownSignal]);

      // Resolve iterator first
      const message = { data: "test message" };
      resolveIterator(message);

      const result = await racePromise;
      expect(result).toEqual(message);
    });
  });

  describe("Shutdown sequence", () => {
    it("should call shutdown signal resolve before nats.stop", async () => {
      const description = createTestDescription();
      const mockNats = {
        addGroup: vi.fn().mockReturnValue({
          addGroup: vi.fn().mockReturnValue({
            addEndpoint: vi.fn().mockReturnValue({}),
          }),
          addEndpoint: vi.fn(),
        }),
        stop: vi.fn().mockResolvedValue(undefined),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new (NatsService as any)(
        description,
        mockNats,
        new MemoryStore(),
        {}
      );

      // Wait for iterator processor to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Mock worker pool
      service.pool = {
        shutdown: vi.fn().mockResolvedValue(undefined),
      };

      // Track call order
      const calls: string[] = [];
      
      const originalResolve = service.shutdownSignal.resolve;
      service.shutdownSignal.resolve = vi.fn((value) => {
        calls.push("shutdown-signal");
        return originalResolve(value);
      });

      mockNats.stop.mockImplementation(async () => {
        calls.push("nats-stop");
      });

      await service.shutdown();

      expect(calls).toEqual(["shutdown-signal", "nats-stop"]);
      expect(service.shutdownSignal.resolve).toHaveBeenCalledWith(null);
      expect(mockNats.stop).toHaveBeenCalledOnce();
    });

    it("should wait for iterator processors to complete", async () => {
      const description = createTestDescription();
      const mockNats = {
        addGroup: vi.fn().mockReturnValue({
          addGroup: vi.fn().mockReturnValue({
            addEndpoint: vi.fn().mockReturnValue({}),
          }),
          addEndpoint: vi.fn(),
        }),
        stop: vi.fn().mockResolvedValue(undefined),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new (NatsService as any)(
        description,
        mockNats,
        new MemoryStore(),
        {}
      );

      // Wait for initial iterator processor to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Mock worker pool
      service.pool = {
        shutdown: vi.fn().mockResolvedValue(undefined),
      };

      // Add mock iterator processors
      let resolveProcessor1: () => void = () => {};
      let resolveProcessor2: () => void = () => {};
      
      const processor1 = new Promise<void>(resolve => {
        resolveProcessor1 = resolve;
      });
      const processor2 = new Promise<void>(resolve => {
        resolveProcessor2 = resolve;
      });

      service.iteratorProcessors.add(processor1);
      service.iteratorProcessors.add(processor2);

      // Start shutdown
      const shutdownPromise = service.shutdown();

      // Processors should still be waiting
      await new Promise(resolve => setTimeout(resolve, 10));

      // Complete processors
      resolveProcessor1();
      resolveProcessor2();

      // Shutdown should now complete
      await shutdownPromise;

      expect(mockNats.stop).toHaveBeenCalledOnce();
      expect(service.pool.shutdown).toHaveBeenCalledOnce();
    });

    it("should handle shutdown when iterator processors complete quickly", async () => {
      const description = createTestDescription();
      const mockNats = {
        addGroup: vi.fn().mockReturnValue({
          addGroup: vi.fn().mockReturnValue({
            addEndpoint: vi.fn().mockReturnValue({}), // Return empty iterator object
          }),
          addEndpoint: vi.fn(),
        }),
        stop: vi.fn().mockResolvedValue(undefined),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new (NatsService as any)(
        description,
        mockNats,
        new MemoryStore(),
        {}
      );

      // Mock worker pool
      service.pool = {
        shutdown: vi.fn().mockResolvedValue(undefined),
      };

      // Wait for iterator processors to complete (should be immediate with mocked null)
      await new Promise(resolve => setTimeout(resolve, 10));

      // Iterator processor should have completed and been removed
      expect(service.iteratorProcessors.size).toBe(0);

      await service.shutdown();

      expect(mockNats.stop).toHaveBeenCalledOnce();
      expect(service.pool.shutdown).toHaveBeenCalledOnce();
    });
  });

  describe("Edge cases", () => {
    it("should handle multiple shutdown calls", async () => {
      const description = createTestDescription();
      const mockNats = {
        addGroup: vi.fn().mockReturnValue({
          addGroup: vi.fn().mockReturnValue({
            addEndpoint: vi.fn().mockReturnValue({}),
          }),
          addEndpoint: vi.fn(),
        }),
        stop: vi.fn().mockResolvedValue(undefined),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new (NatsService as any)(
        description,
        mockNats,
        new MemoryStore(),
        {}
      );

      // Wait for iterator processor to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      service.pool = {
        shutdown: vi.fn().mockResolvedValue(undefined),
      };

      // Call shutdown multiple times
      const shutdown1 = service.shutdown();
      const shutdown2 = service.shutdown();
      const shutdown3 = service.shutdown();

      await Promise.all([shutdown1, shutdown2, shutdown3]);

      // Should not throw or cause issues
      expect(mockNats.stop).toHaveBeenCalled();
    });

    it("should handle shutdown signal resolve being called multiple times", async () => {
      const description = createTestDescription();
      const mockNats = {
        addGroup: vi.fn().mockReturnValue({
          addGroup: vi.fn().mockReturnValue({
            addEndpoint: vi.fn().mockReturnValue({}),
          }),
          addEndpoint: vi.fn(),
        }),
        stop: vi.fn().mockResolvedValue(undefined),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new (NatsService as any)(
        description,
        mockNats,
        new MemoryStore(),
        {}
      );

      // Wait for iterator processor to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      service.pool = {
        shutdown: vi.fn().mockResolvedValue(undefined),
      };

      // Manually resolve shutdown signal multiple times
      service.shutdownSignal.resolve(null);
      service.shutdownSignal.resolve(null);
      service.shutdownSignal.resolve(null);

      // Should still be able to shutdown normally
      await service.shutdown();

      expect(mockNats.stop).toHaveBeenCalledOnce();
    });
  });
});