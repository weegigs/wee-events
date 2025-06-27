import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorkerPool, WorkerPoolShutdownError, WorkerPoolTimeoutError } from "./worker-pool";

describe("WorkerPool", () => {
  let pool: WorkerPool<string>;

  beforeEach(() => {
    pool = new WorkerPool<string>(5, 1000);
  });

  describe("execute", () => {
    it("should execute work when capacity is available", async () => {
      const work = vi.fn(async () => "result");
      
      const result = await pool.execute(work);
      
      expect(result).toBe("result");
      expect(work).toHaveBeenCalledOnce();
    });

    it("should pass abort signal to work function", async () => {
      const work = vi.fn(async (signal: AbortSignal) => {
        expect(signal).toBeInstanceOf(AbortSignal);
        expect(signal.aborted).toBe(false);
        return "result";
      });
      
      await pool.execute(work);
      
      expect(work).toHaveBeenCalledOnce();
    });

    it("should respect concurrency limits", async () => {
      pool = new WorkerPool(2, 1000);

      const blockedWork = vi.fn(
        () => new Promise<string>(resolve => setTimeout(() => resolve("blocked"), 100))
      );
      const quickWork = vi.fn(async () => "quick");

      // Start 2 blocking tasks (fills capacity)
      const promise1 = pool.execute(blockedWork);
      const promise2 = pool.execute(blockedWork);

      // Third task should wait for capacity
      const promise3 = pool.execute(quickWork);

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

      await expect(pool.execute(work)).rejects.toThrow("Work failed");
      expect(work).toHaveBeenCalledOnce();
    });

    it("should throw WorkerPoolTimeoutError when work exceeds timeout", async () => {
      const work = vi.fn(
        () => new Promise<string>(resolve => setTimeout(() => resolve("late"), 200))
      );

      await expect(pool.execute(work, { timeout: 50 })).rejects.toThrowError(WorkerPoolTimeoutError);
      expect(work).toHaveBeenCalledOnce();
    });

    it("should throw WorkerPoolShutdownError when pool is shutting down", async () => {
      const work = vi.fn(async () => "result");

      // Start shutdown
      const shutdownPromise = pool.shutdown();

      // Try to execute work while shutting down
      await expect(pool.execute(work)).rejects.toThrowError(WorkerPoolShutdownError);

      expect(work).not.toHaveBeenCalled();

      await shutdownPromise;
    });

    it("should notify waiting tasks when capacity becomes available", async () => {
      pool = new WorkerPool(1, 1000);

      let resolveFirst: () => void = () => {};
      const firstWork = vi.fn(
        () => new Promise<string>(resolve => {
          resolveFirst = () => resolve("first");
        })
      );
      const secondWork = vi.fn(async () => "second");

      // Start first task (fills capacity)
      const firstPromise = pool.execute(firstWork);

      // Start second task (should wait)
      const secondPromise = pool.execute(secondWork);

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
        () =>
          new Promise<string>((resolve) => {
            resolveWork = () => resolve("completed");
          })
      );

      // Start work
      const workPromise = pool.execute(work);

      // Start shutdown
      const shutdownPromise = pool.shutdown();

      // Wait a bit - shutdown should be waiting
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Complete the work
      resolveWork();

      // Shutdown should now complete
      await shutdownPromise;

      // The work promise should resolve successfully
      await expect(workPromise).resolves.toBe("completed");

      expect(work).toHaveBeenCalledOnce();
    });

    it("should wake up waiting tasks and throw WorkerPoolShutdownError", async () => {
      pool = new WorkerPool(1, 1000);

      const firstWork = vi.fn(() => new Promise<string>(() => {})); // A promise that never resolves
      const secondWork = vi.fn(async () => "second");

      // Start first task (fills capacity)
      pool.execute(firstWork);

      // Start second task (should wait)
      const secondPromise = pool.execute(secondWork);

      // Start shutdown
      pool.shutdown();

      // Second task should wake up and throw
      await expect(secondPromise).rejects.toThrowError(WorkerPoolShutdownError);
      expect(secondWork).not.toHaveBeenCalled();
    });

    it("should timeout if activities don't complete within shutdownTimeout", async () => {
      pool = new WorkerPool(5, 50);

      const work = vi.fn(
        () =>
          new Promise<string>(() => {
            // Never resolves
          })
      );

      // Start long-running work
      pool.execute(work);

      // Add a small delay to ensure the activity is registered
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Shutdown should timeout
      const startTime = Date.now();
      await pool.shutdown();
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(45); // Allow some timing variance
      expect(duration).toBeLessThan(100); // But not too much variance
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

      await expect(pool.execute(work, { timeout: 50 })).rejects.toThrowError(WorkerPoolTimeoutError);
    });

    it("should clean up activities properly even when work throws", async () => {
      pool = new WorkerPool(1, 1000);

      const failingWork = vi.fn(async () => {
        throw new Error("Work failed");
      });
      const successWork = vi.fn(async () => "success");

      // First work fails
      await expect(pool.execute(failingWork)).rejects.toThrow("Work failed");

      // Second work should still be able to execute (capacity was cleaned up)
      const result = await pool.execute(successWork);
      expect(result).toBe("success");
    });
  });
});
