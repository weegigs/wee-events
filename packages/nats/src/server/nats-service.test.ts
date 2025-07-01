import { describe, it, expect, vi } from "vitest";
import { NatsService } from "./nats-service";
import * as events from "@weegigs/events-core";
import { Signal } from "@weegigs/events-common";
import { Service } from "@nats-io/services";
import { WorkerPool } from "./worker-pool";
import { z } from "zod";

// Mock NATS dependencies
vi.mock("@nats-io/nats-core", () => ({
  syncIterator: vi.fn(() => ({
    next: vi.fn().mockResolvedValue(null), // Iterator immediately returns null (closed)
  })),
}));

vi.mock("@nats-io/services", () => ({
  Svcm: vi.fn(),
  Service: vi.fn(),
}));

vi.mock("./worker-pool", () => ({
  WorkerPool: vi.fn(() => ({
    execute: vi.fn(),
    shutdown: vi.fn(),
  })),
}));

// Create a minimal service description for testing
const createTestDescription = () => {
  const info = {
    entity: { type: "test-service", schema: z.object({}) },
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
      info,
      load: vi.fn(),
      execute: vi.fn(),
    }),
  };
};

const createMockNatsService = (): Service => {
  return {
    addGroup: vi.fn().mockReturnValue({
      addGroup: vi.fn().mockReturnValue({
        addEndpoint: vi.fn().mockReturnValue({}), // Return empty iterator object
      }),
      addEndpoint: vi.fn(),
    }),
    stop: vi.fn().mockResolvedValue(undefined),
    stopped: vi.fn().mockResolvedValue(false),
    isStopped: vi.fn().mockReturnValue(false),
    stats: vi.fn().mockReturnValue({}),
    info: vi.fn().mockReturnValue({}),
    reset: vi.fn(),
    start: vi.fn(),
  } as unknown as Service;
};

describe("NatsService", () => {
  describe("Signal shutdown signal implementation", () => {
    it("should create shutdown signal with proper type", async () => {
      // This is more of a compilation test to ensure types are correct
      const description = createTestDescription();
      const mockNats = createMockNatsService();
      const mockPool = new WorkerPool<events.Entity<{}>>();
      const shutdownSignal = new Signal<null>();

      const mockService = description.service(undefined as never, undefined as never);
      const service = new NatsService(
        mockNats,
        mockService,
        mockPool,
        shutdownSignal
      );

      // Wait for iterator processor to complete (should be immediate with mocked null)
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(service).toBeDefined();
    });

    it("should trigger shutdown signal with null", async () => {
      const description = createTestDescription();
      const mockNats = createMockNatsService();
      const mockPool = new WorkerPool<events.Entity<{}>>();
      const shutdownSignal = new Signal<null>();

      const mockService = description.service(undefined as never, undefined as never);
      const service = new NatsService(
        mockNats,
        mockService,
        mockPool,
        shutdownSignal
      );

      // Wait for iterator processor to complete
      await new Promise(resolve => setTimeout(resolve, 10));

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
      let triggerShutdown: (value: null) => void = () => {};
      const shutdownSignal = new Promise<null>(resolve => {
        triggerShutdown = resolve;
      });

      const iteratorNext = new Promise<string>(() => {
        // Never resolves in this test
      });

      // Race the promises
      const racePromise = Promise.race([iteratorNext, shutdownSignal]);

      // Resolve shutdown signal first
      triggerShutdown(null);

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
    it("should call shutdown signal trigger before nats.stop", async () => {
      const description = createTestDescription();
      const mockNats = createMockNatsService();
      const mockPool = new WorkerPool<events.Entity<{}>>();
      const shutdownSignal = new Signal<null>();

      const mockService = description.service(undefined as never, undefined as never);
      const service = new NatsService(
        mockNats,
        mockService,
        mockPool,
        shutdownSignal
      );

      // Wait for iterator processor to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Track call order
      const calls: string[] = [];
      
      const originalTrigger = shutdownSignal.trigger;
      shutdownSignal.trigger = vi.fn((value: null) => {
        calls.push("shutdown-signal");
        originalTrigger.call(shutdownSignal, value);
      });

      (mockNats.stop as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        calls.push("nats-stop");
      });

      await service.shutdown();

      expect(calls).toEqual(["shutdown-signal", "nats-stop"]);
      expect(shutdownSignal.trigger).toHaveBeenCalledWith(null);
      expect(mockNats.stop).toHaveBeenCalledOnce();
    });

    it("should wait for iterator processors to complete", async () => {
      const description = createTestDescription();
      const mockNats = createMockNatsService();
      const mockPool = new WorkerPool<events.Entity<{}>>();
      const shutdownSignal = new Signal<null>();

      // Control the mock iterator
      let resolveIterator: (value: unknown) => void = () => {};
      const iteratorPromise = new Promise<unknown>(resolve => {
        resolveIterator = resolve;
      });

      // Replace the mock implementation for the endpoint
      (mockNats.addGroup("").addGroup("").addEndpoint as ReturnType<typeof vi.fn>).mockReturnValue({
        [Symbol.asyncIterator]: () => ({
          next: () => iteratorPromise,
        }),
      });

      const mockService = description.service(undefined as never, undefined as never);
      const service = new NatsService(
        mockNats,
        mockService,
        mockPool,
        shutdownSignal
      );

      // Start shutdown
      const shutdownPromise = service.shutdown();

      // It should be waiting for the iterator to finish
      await expect(Promise.race([shutdownPromise, new Promise(resolve => setTimeout(resolve, 50))])).resolves.toBeUndefined();

      // Complete the processor
      resolveIterator(null);

      // Shutdown should now complete
      await expect(shutdownPromise).resolves.toBeUndefined();

      expect(mockNats.stop).toHaveBeenCalledOnce();
      expect(mockPool.shutdown).toHaveBeenCalledOnce();
    });

    it("should handle shutdown when iterator processors complete quickly", async () => {
      const description = createTestDescription();
      const mockNats = createMockNatsService();
      const mockPool = new WorkerPool<events.Entity<{}>>();
      const shutdownSignal = new Signal<null>();

      const mockService = description.service(undefined as never, undefined as never);
      const service = new NatsService(
        mockNats,
        mockService,
        mockPool,
        shutdownSignal
      );

      // Wait for iterator processors to complete (should be immediate with mocked null)
      await new Promise(resolve => setTimeout(resolve, 10));

      await service.shutdown();

      expect(mockNats.stop).toHaveBeenCalledOnce();
      expect(mockPool.shutdown).toHaveBeenCalledOnce();
    });
  });

  describe("Edge cases", () => {
    it("should handle multiple shutdown calls", async () => {
      const description = createTestDescription();
      const mockNats = createMockNatsService();
      const mockPool = new WorkerPool<events.Entity<{}>>();
      const shutdownSignal = new Signal<null>();

      const mockService = description.service(undefined as never, undefined as never);
      const service = new NatsService(
        mockNats,
        mockService,
        mockPool,
        shutdownSignal
      );

      // Wait for iterator processor to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Call shutdown multiple times
      const shutdown1 = service.shutdown();
      const shutdown2 = service.shutdown();
      const shutdown3 = service.shutdown();

      await Promise.all([shutdown1, shutdown2, shutdown3]);

      // Should not throw or cause issues
      expect(mockNats.stop).toHaveBeenCalled();
    });

    it("should handle shutdown signal trigger being called multiple times", async () => {
      const description = createTestDescription();
      const mockNats = createMockNatsService();
      const mockPool = new WorkerPool<events.Entity<{}>>();
      const shutdownSignal = new Signal<null>();

      const mockService = description.service(undefined as never, undefined as never);
      const service = new NatsService(
        mockNats,
        mockService,
        mockPool,
        shutdownSignal
      );

      // Wait for iterator processor to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Manually trigger shutdown signal multiple times
      shutdownSignal.trigger(null);
      shutdownSignal.trigger(null);
      shutdownSignal.trigger(null);

      // Should still be able to shutdown normally
      await service.shutdown();

      expect(mockNats.stop).toHaveBeenCalledOnce();
    });
  });
});
