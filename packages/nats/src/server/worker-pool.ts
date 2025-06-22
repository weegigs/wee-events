export type WorkerPoolConfig = {
  concurrency: number;
  shutdownTimeout: number;
};

export namespace WorkerPoolConfig {
  export const create = (): WorkerPoolConfig => ({
    concurrency: 5,
    shutdownTimeout: 30000,
  });
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

namespace Deferred {
  export function create<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }
}

export class WorkerPool<R> {
  private activities = new Set<Promise<R>>();
  private isShuttingDown = false;
  private waitingForCapacity: Deferred<void>[] = [];

  constructor(private readonly config: WorkerPoolConfig = WorkerPoolConfig.create()) {}

  /**
   * Execute work with guaranteed capacity and cleanup
   * Returns result, 'shutting-down', or 'timeout'
   */
  async withCapacity(
    work: (signal: AbortSignal) => Promise<R>,
    options: { timeout: number } = { timeout: 30000 }
  ): Promise<R | "shutting-down" | "timeout"> {
    // Wait for capacity
    while (this.activities.size >= this.config.concurrency && !this.isShuttingDown) {
      const deferred = Deferred.create<void>();
      this.waitingForCapacity.push(deferred);
      await deferred.promise;
    }

    if (this.isShuttingDown) {
      return "shutting-down";
    }

    // Create abort controller for timeout and cancellation
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, options.timeout);

    // Execute work with guaranteed cleanup
    const activity = work(controller.signal);
    this.activities.add(activity);

    try {
      const result = await activity;
      clearTimeout(timeout);

      if (controller.signal.aborted) {
        return "timeout";
      }

      return result;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    } finally {
      this.activities.delete(activity);
      this.notifyCapacityAvailable();
    }
  }

  private notifyCapacityAvailable(): void {
    if (this.waitingForCapacity.length > 0 && this.activities.size < this.config.concurrency) {
      const deferred = this.waitingForCapacity.shift();
      if (deferred) {
        deferred.resolve();
      }
    }
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Wake up all waiting callers - they'll see isShuttingDown = true
    for (const deferred of this.waitingForCapacity) {
      deferred.resolve();
    }
    this.waitingForCapacity.length = 0;

    if (this.activities.size === 0) {
      return;
    }

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(resolve, this.config.shutdownTimeout);
    });

    await Promise.race([Promise.allSettled(this.activities), timeoutPromise]);
  }
}
