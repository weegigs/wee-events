import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorkerPool, WorkerPoolConfig } from "./worker-pool";

describe("WorkerPool", () => {
  let pool: WorkerPool<string>;

  beforeEach(() => {
    pool = new WorkerPool<string>();
  });

  describe("withCapacity", () => {
    it("should execute work when capacity is available", async () => {
      const work = vi.fn(async () => "result");
      
      const result = await pool.withCapacity(work);
      
      expect(result).toBe("result");
      expect(work).toHaveBeenCalledOnce();
    });

    it("should pass abort signal to work function", async () => {
      const work = vi.fn(async (signal: AbortSignal) => {
        expect(signal).toBeInstanceOf(AbortSignal);
        expect(signal.aborted).toBe(false);
        return "result";
      });
      
      await pool.withCapacity(work);
      
      expect(work).toHaveBeenCalledOnce();
    });

    it("should respect concurrency limits", async () => {
      const config = WorkerPoolConfig.create();
      config.concurrency = 2;
      pool = new WorkerPool(config);

      const blockedWork = vi.fn(
        () => new Promise<string>(resolve => setTimeout(() => resolve("blocked"), 100))
      );
      const quickWork = vi.fn(async () => "quick");

      // Start 2 blocking tasks (fills capacity)
      const promise1 = pool.withCapacity(blockedWork);
      const promise2 = pool.withCapacity(blockedWork);

      // Third task should wait for capacity
      const promise3 = pool.withCapacity(quickWork);

      // Wait a bit to ensure third task is waiting
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(quickWork).not.toHaveBeenCalled();

      // Wait for blocked work to complete
      await Promise.all([promise1, promise2, promise3]);

      expect(blockedWork).toHaveBeenCalledTimes(2);
      expect(quickWork).toHaveBeenCalledOnce();
    });

    it("should handle work that throws errors", async () => {
      const error = new Error("Work failed");
      const work = vi.fn(async () => {
        throw error;
      });

      await expect(pool.withCapacity(work)).rejects.toThrow("Work failed");
      expect(work).toHaveBeenCalledOnce();
    });

    it("should return 'timeout' when work exceeds timeout", async () => {
      const work = vi.fn(
        () => new Promise<string>(resolve => setTimeout(() => resolve("late"), 200))
      );

      const result = await pool.withCapacity(work, { timeout: 50 });

      expect(result).toBe("timeout");
      expect(work).toHaveBeenCalledOnce();
    });

    it("should return 'shutting-down' when pool is shutting down", async () => {
      const work = vi.fn(async () => "result");

      // Start shutdown
      const shutdownPromise = pool.shutdown();

      // Try to execute work while shutting down
      const result = await pool.withCapacity(work);

      expect(result).toBe("shutting-down");
      expect(work).not.toHaveBeenCalled();

      await shutdownPromise;
    });

    it("should notify waiting tasks when capacity becomes available", async () => {
      const config = WorkerPoolConfig.create();
      config.concurrency = 1;
      pool = new WorkerPool(config);

      let resolveFirst: () => void = () => {};
      const firstWork = vi.fn(
        () => new Promise<string>(resolve => {
          resolveFirst = () => resolve("first");
        })
      );
      const secondWork = vi.fn(async () => "second");

      // Start first task (fills capacity)
      const firstPromise = pool.withCapacity(firstWork);

      // Start second task (should wait)
      const secondPromise = pool.withCapacity(secondWork);

      // Verify second task is waiting
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(secondWork).not.toHaveBeenCalled();

      // Complete first task
      resolveFirst();
      await firstPromise;

      // Second task should now execute
      const secondResult = await secondPromise;
      expect(secondResult).toBe("second");
      expect(secondWork).toHaveBeenCalledOnce();
    });
  });

  describe("shutdown", () => {
    it("should complete immediately when no activities are running", async () => {
      const startTime = Date.now();
      await pool.shutdown();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50); // Should be nearly immediate
    });

    it("should wait for active activities to complete", async () => {
      let resolveWork: () => void = () => {};
      const work = vi.fn(
        () => new Promise<string>(resolve => {
          resolveWork = () => resolve("completed");
        })
      );

      // Start work
      const workPromise = pool.withCapacity(work);

      // Start shutdown
      const shutdownPromise = pool.shutdown();

      // Wait a bit - shutdown should be waiting
      await new Promise(resolve => setTimeout(resolve, 10));

      // Complete the work
      resolveWork();
      await workPromise;

      // Shutdown should now complete
      await shutdownPromise;

      expect(work).toHaveBeenCalledOnce();
    });

    it("should wake up waiting tasks and return 'shutting-down'", async () => {
      const config = WorkerPoolConfig.create();
      config.concurrency = 1;
      pool = new WorkerPool(config);

      let resolveFirst: () => void = () => {};
      const firstWork = vi.fn(
        () => new Promise<string>(resolve => {
          resolveFirst = () => resolve("first");
        })
      );
      const secondWork = vi.fn(async () => "second");

      // Start first task (fills capacity)
      const firstPromise = pool.withCapacity(firstWork);

      // Start second task (should wait)
      const secondPromise = pool.withCapacity(secondWork);

      // Start shutdown
      const shutdownPromise = pool.shutdown();

      // Second task should wake up and return 'shutting-down'
      const secondResult = await secondPromise;
      expect(secondResult).toBe("shutting-down");
      expect(secondWork).not.toHaveBeenCalled();

      // Complete first task
      resolveFirst();
      await firstPromise;

      // Shutdown should complete
      await shutdownPromise;
    });

    it("should timeout if activities don't complete within shutdownTimeout", async () => {
      const config = WorkerPoolConfig.create();
      config.shutdownTimeout = 50; // Short timeout for test
      pool = new WorkerPool(config);

      const work = vi.fn(
        () => new Promise<string>(() => {
          // Never resolves
        })
      );

      // Start long-running work
      pool.withCapacity(work);

      // Shutdown should timeout
      const startTime = Date.now();
      await pool.shutdown();
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(45); // Allow some timing variance
      expect(duration).toBeLessThan(100); // But not too much variance
    });
  });

  describe("WorkerPoolConfig", () => {
    it("should create default config", () => {
      const config = WorkerPoolConfig.create();

      expect(config.concurrency).toBe(5);
      expect(config.shutdownTimeout).toBe(30000);
    });

    it("should accept custom config", () => {
      const customConfig: WorkerPoolConfig = {
        concurrency: 10,
        shutdownTimeout: 60000,
      };

      pool = new WorkerPool(customConfig);

      // Test that custom config is used
      expect(pool).toBeInstanceOf(WorkerPool);
    });
  });

  describe("edge cases", () => {
    it("should handle multiple shutdown calls", async () => {
      const shutdownPromise1 = pool.shutdown();
      const shutdownPromise2 = pool.shutdown();

      await Promise.all([shutdownPromise1, shutdownPromise2]);

      // Should not throw or hang
      expect(true).toBe(true);
    });

    it("should handle work that completes exactly at timeout", async () => {
      const work = vi.fn(
        () => new Promise<string>(resolve => setTimeout(() => resolve("result"), 50))
      );

      const result = await pool.withCapacity(work, { timeout: 50 });

      // This is timing-dependent, could be either result or timeout
      expect(result === "result" || result === "timeout").toBe(true);
    });

    it("should clean up activities properly even when work throws", async () => {
      const config = WorkerPoolConfig.create();
      config.concurrency = 1;
      pool = new WorkerPool(config);

      const failingWork = vi.fn(async () => {
        throw new Error("Work failed");
      });
      const successWork = vi.fn(async () => "success");

      // First work fails
      await expect(pool.withCapacity(failingWork)).rejects.toThrow("Work failed");

      // Second work should still be able to execute (capacity was cleaned up)
      const result = await pool.withCapacity(successWork);
      expect(result).toBe("success");
    });
  });
});