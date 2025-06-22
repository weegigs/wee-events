import { NatsConnection, QueuedIterator, syncIterator } from "@nats-io/nats-core";
import { Svcm, Service, ServiceMsg, ServiceGroup } from "@nats-io/services";
import * as events from "@weegigs/events-core";
import { WorkerPool } from "./worker-pool";
import { ExecuteRequest, FetchRequest, FetchResponse } from "../messages";

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

// Service wrapper
export class NatsService<S extends events.State> {
  public static create<R extends events.Environment, S extends events.State>(
    description: events.ServiceDescription<R, S>
  ) {
    return {
      async connect(connection: NatsConnection, store: events.EventStore, environment: Omit<R, "publish">) {
        const info = description.info();

        // Create NATS microservice (async part)
        const svcm = new Svcm(connection);
        const nats = await svcm.add({
          name: info.entity.type,
          version: info.version,
          description: info.description ?? "",
        });

        return new NatsService(description, nats, store, environment);
      },
    };
  }

  private readonly service: events.Service<S>;
  private readonly pool: WorkerPool<events.Entity<S>>;
  private readonly iteratorProcessors = new Set<Promise<void>>();
  private readonly shutdownSignal = Deferred.create<null>();

  constructor(
    description: events.ServiceDescription<events.Environment, S>,
    private readonly nats: Service,
    store: events.EventStore,
    environment: Omit<events.Environment, "publish">
  ) {
    // Create core service
    this.service = description.service(store, environment);

    // Create worker pool
    this.pool = new WorkerPool();

    // Get service info
    const info = description.info();

    // Set up service group with service name (type)
    const serviceGroup = this.nats.addGroup(info.entity.type);
    
    // Set up command endpoints under service group
    const commands = serviceGroup.addGroup("commands");
    for (const [command] of Object.entries(description.commands())) {
      this.registerCommand(commands, command);
    }

    // Set up fetch endpoint under service group
    serviceGroup.addEndpoint("fetch", async (err, msg) => {
      if (err) return;

      try {
        // Parse and validate request
        const request = msg.json();
        const parsed = FetchRequest.schema.safeParse(request);

        if (!parsed.success) {
          msg.respondError(400, `Invalid request: ${parsed.error.message}`);
          return;
        }

        // Load entity using core service
        const aggregateId = {
          type: parsed.data.aggregateId.type,
          key: parsed.data.aggregateId.key,
        } as events.AggregateId;
        const entity = await this.service.load(aggregateId);

        // Send successful response
        const response: FetchResponse.Type = { entity };
        msg.respond(JSON.stringify(response));
      } catch (error) {
        // Map domain errors to appropriate responses
        if (error instanceof events.EntityNotAvailableError) {
          msg.respondError(404, error.message);
        } else {
          // Generic error for unexpected failures
          msg.respondError(500, error instanceof Error ? error.message : String(error));
        }
      }
    });
  }

  private registerCommand(commands: ServiceGroup, command: string): void {
    const iterator = commands.addEndpoint(command); // No callback = returns iterator
    const processor = this.processCommandIterator(command, iterator);
    this.iteratorProcessors.add(processor);
    processor.finally(() => {
      this.iteratorProcessors.delete(processor);
    });
  }

  private async processCommandIterator(command: string, queue: QueuedIterator<ServiceMsg>): Promise<void> {
    // Convert to manual iterator for capacity-controlled pulling
    const iterator = syncIterator(queue);

    try {
      while (true) {
        // Race iterator.next() with shutdown signal to avoid hanging
        const result = await Promise.race([
          iterator.next(),
          this.shutdownSignal.promise
        ]);

        if (result === null) {
          // Either iterator closed or shutdown signaled
          break;
        }

        // Parse NATS message and process with capacity management
        await this.handleCommandMessage(result);
      }
    } catch (error) {
      // Iterator error - log but don't crash service
      console.error(`Iterator error for command ${command}:`, error);
    }
  }

  private async handleCommandMessage(message: ServiceMsg): Promise<void> {
    // Parse NATS message
    const parsed = ExecuteRequest.schema.safeParse(message.json());

    if (!parsed.success) {
      message.respondError(400, "Invalid command");
      return;
    }

    try {
      // Process command through pool with capacity management
      const result = await this.pool.withCapacity(async (signal: AbortSignal) => {
        if (signal.aborted) {
          throw new Error("Operation cancelled");
        }
        const target = { type: parsed.data.target.type, key: parsed.data.target.key } as events.AggregateId;
        return await this.service.execute(parsed.data.command, target, parsed.data.payload);
      });

      if (result === "shutting-down") {
        // Service is shutting down - don't respond, let message stay in queue
        return;
      }

      if (result === "timeout") {
        message.respondError(503, "service overloaded - timeout");
        return;
      }

      // Send successful response
      const response = {
        entity: result,
        metadata: parsed.data.metadata,
      };

      if (!message.respond(JSON.stringify(response))) {
        console.error("Failed to send response to NATS message");
      }
    } catch (error) {
      // Map domain errors to appropriate responses
      if (error instanceof events.EntityNotAvailableError) {
        message.respondError(404, `Not Found: ${error.message}`);
      } else if (error instanceof events.CommandValidationError) {
        message.respondError(400, `Bad Request: ${error.message}`);
      } else if (error instanceof events.HandlerNotFound) {
        message.respondError(500, `Handler Not Found: ${error.message}`);
      } else {
        message.respondError(500, error instanceof Error ? error.message : String(error));
      }
    }
  }

  // Start the service (if needed - NATS services may auto-start)
  async start(): Promise<void> {
    // NATS services typically start automatically when created
    // This method is provided for consistency and future extension
  }

  // Graceful cleanup method
  async shutdown(): Promise<void> {
    // Signal all iterators to exit immediately
    this.shutdownSignal.resolve(null);
    
    // Stop accepting new messages
    await this.nats.stop();

    // Wait for all iterator processors to complete (should be immediate now)
    if (this.iteratorProcessors.size > 0) {
      await Promise.allSettled(this.iteratorProcessors);
    }

    // Then shutdown pool (processes remaining messages)
    await this.pool.shutdown();
  }
}
