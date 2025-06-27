import { NatsConnection, QueuedIterator, syncIterator } from "@nats-io/nats-core";
import { Svcm, Service, ServiceMsg, ServiceGroup } from "@nats-io/services";
import * as events from "@weegigs/events-core";
import { Signal } from "@weegigs/events-common";
import { WorkerPool, WorkerPoolShutdownError, WorkerPoolTimeoutError } from "./worker-pool";
import { ExecuteRequest, LoadRequest, LoadResponse } from "../messages";
import { NatsServiceErrorCodes, NatsServiceErrorPayload, NatsServiceErrorCode } from "../errors";
import { z } from "zod";

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
  private readonly shutdownSignal = new Signal<null>();

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

    // Set up command endpoint under service group
    this.registerCommandEndpoint(serviceGroup);

    // Set up load endpoint under service group
    serviceGroup.addEndpoint("load", async (err, msg) => {
      if (err) return;

      try {
        // Parse and validate request
        const request = msg.json();
        const parsed = LoadRequest.schema.safeParse(request);

        if (!parsed.success) {
          const payload: NatsServiceErrorPayload = {
            error: {
              name: "InvalidRequest",
              code: NatsServiceErrorCodes.InvalidRequest,
              message: `Invalid request: ${parsed.error.message}`,
            },
          };
          msg.respond(JSON.stringify(payload));
          return;
        }

        // Load entity using core service
        const entity = await this.service.load(parsed.data.aggregateId);

        // Send successful response
        const response: LoadResponse.Type<z.ZodType<S>> = { entity };
        msg.respond(JSON.stringify(response));
      } catch (error) {
        this.handleError(msg, error);
      }
    });
  }

  private registerCommandEndpoint(group: ServiceGroup): void {
    const iterator = group.addEndpoint("execute"); // No callback = returns iterator
    const processor = this.processCommandIterator(iterator);
    this.iteratorProcessors.add(processor);
    processor.finally(() => {
      this.iteratorProcessors.delete(processor);
    });
  }

  private async processCommandIterator(queue: QueuedIterator<ServiceMsg>): Promise<void> {
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
      console.error(`Iterator error for command endpoint:`, error);
    }
  }

  private async handleCommandMessage(message: ServiceMsg): Promise<void> {
    // Parse NATS message
    const parsed = ExecuteRequest.schema.safeParse(message.json());

    if (!parsed.success) {
      const payload: NatsServiceErrorPayload = {
        error: {
          name: "InvalidCommand",
          code: NatsServiceErrorCodes.InvalidRequest,
          message: "Invalid command",
        },
      };
      message.respond(JSON.stringify(payload));
      return;
    }

    try {
      // Process command through pool with capacity management
      const entity = await this.pool.execute(async (signal: AbortSignal) => {
        if (signal.aborted) {
          throw new Error("Operation cancelled");
        }
        return await this.service.execute(parsed.data.command, parsed.data.target, parsed.data.payload);
      });

      // Send successful response
      const response = {
        entity,
        metadata: parsed.data.metadata,
      };

      if (!message.respond(JSON.stringify(response))) {
        console.error("Failed to send response to NATS message");
      }
    } catch (error) {
      this.handleError(message, error);
    }
  }

  private handleError(msg: ServiceMsg, error: unknown): void {
    if (error instanceof WorkerPoolShutdownError) {
      // Service is shutting down - don't respond, let message stay in queue
      return;
    }

    if (error instanceof WorkerPoolTimeoutError) {
      const payload: NatsServiceErrorPayload = {
        error: {
          name: error.name,
          code: NatsServiceErrorCodes.ServiceOverloaded,
          message: error.message,
        },
      };
      msg.respond(JSON.stringify(payload));
      return;
    }

    if (error instanceof Error && 'toJSON' in error && typeof (error as { toJSON: () => Record<string, unknown> }).toJSON === 'function') {
      const payload: NatsServiceErrorPayload = {
        error: {
          name: error.name,
          code: this.getErrorCode(error),
          message: error.message,
          details: (error as events.ISerializableError).toJSON(),
        },
      };
      msg.respond(JSON.stringify(payload));
      return;
    }

    const payload: NatsServiceErrorPayload = {
      error: {
        name: "UnknownError",
        code: NatsServiceErrorCodes.Unknown,
        message: error instanceof Error ? error.message : String(error),
      },
    };
    msg.respond(JSON.stringify(payload));
  }

  private getErrorCode(error: Error): NatsServiceErrorCode {
    if (error instanceof events.EntityNotAvailableError) {
      return NatsServiceErrorCodes.EntityNotFound;
    }
    if (error instanceof events.CommandValidationError) {
      return NatsServiceErrorCodes.CommandValidation;
    }
    if (error instanceof events.HandlerNotFound) {
      return NatsServiceErrorCodes.HandlerNotFound;
    }
    return NatsServiceErrorCodes.Unknown;
  }

  // Start the service (if needed - NATS services may auto-start)
  async start(): Promise<void> {
    // NATS services typically start automatically when created
    // This method is provided for consistency and future extension
  }

  // Graceful cleanup method
  async shutdown(): Promise<void> {
    // Signal all iterators to exit immediately
    this.shutdownSignal.trigger(null);
    
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
