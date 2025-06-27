import { Semaphore } from "async-mutex";

export class WorkerPoolShutdownError extends Error {
  constructor() {
    super("Worker pool is shutting down");
    this.name = "WorkerPoolShutdownError";
  }
}

export class WorkerPoolTimeoutError extends Error {
  constructor(timeout: number) {
    super(`Operation timed out after ${timeout}ms`);
    this.name = "WorkerPoolTimeoutError";
  }
}

export class WorkerPool<R> {
  private activities = new Set<Promise<R>>();
  private isShuttingDown = false;
  private semaphore: Semaphore;

  constructor(
    concurrency: number = 5,
    private readonly shutdownTimeout: number = 30000
  ) {
    this.semaphore = new Semaphore(concurrency);
  }

  /**
   * Executes a unit of work within the pool's capacity limits.
   *
   * @param work The async function to execute.
   * @param options Configuration for the execution, like timeout.
   * @returns A promise that resolves with the result of the work.
   *
   * @throws {WorkerPoolShutdownError} If the pool is in the process of shutting down.
   * @throws {WorkerPoolTimeoutError} If the work does not complete within the specified timeout.
   */
  async execute(
    work: (signal: AbortSignal) => Promise<R>,
    options: { timeout: number } = { timeout: 30000 }
  ): Promise<R> {
    if (this.isShuttingDown) {
      throw new WorkerPoolShutdownError();
    }

    let release: () => void;
    try {
      [, release] = await this.semaphore.acquire();
    } catch (error) {
      if (error instanceof Error && error.message === "request for lock canceled") {
        throw new WorkerPoolShutdownError();
      }
      throw error;
    }

    try {
      const controller = new AbortController();
      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, options.timeout);

      const activity = work(controller.signal);
      this.activities.add(activity);

      try {
        const result = await activity;

        if (timedOut) {
          throw new WorkerPoolTimeoutError(options.timeout);
        }

        return result;
      } catch (error) {
        if (timedOut) {
          throw new WorkerPoolTimeoutError(options.timeout);
        }
        throw error;
      } finally {
        clearTimeout(timeout); // Always clean up timer
        this.activities.delete(activity);
      }
    } finally {
      release();
    }
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.semaphore.cancel();

    if (this.activities.size === 0) {
      return;
    }

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(resolve, this.shutdownTimeout);
    });

    await Promise.race([Promise.allSettled(this.activities), timeoutPromise]);
  }
}
