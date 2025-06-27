import { NatsConnection, RequestOptions } from "@nats-io/nats-core";
import { connect } from "@nats-io/transport-node";
import { AggregateId, Entity, ServiceDescription, Environment, State, Command, Service } from "@weegigs/events-core";
import { ulid } from "ulid";

import { ExecuteRequest, ExecuteResponse, LoadRequest, LoadResponse } from "../messages";
import { mapNatsError, UnknownCommandError, InvalidCommandPayloadError, InvalidResponseFormatError } from "./errors";

/**
 * Base NATS client for event service communication that implements the core Service interface
 */
export class NatsClient<S extends State = State> implements Service<S> {
  public static create<S extends State = State>(description: ServiceDescription<Environment, S>) {
    return {
      async connect(natsUrl: string): Promise<NatsClient<S>> {
        const connection = await connect({
          servers: natsUrl,
          timeout: 5000,
          maxReconnectAttempts: 10,
          reconnectTimeWait: 2000,
        });

        return new NatsClient(connection, description);
      },
    };
  }

  private readonly type: string;
  private readonly commands: ReturnType<ServiceDescription<Environment, S>["commands"]>;
  private readonly description: ServiceDescription<Environment, S>;

  constructor(
    private readonly connection: NatsConnection,
    description: ServiceDescription<Environment, S>
  ) {
    this.type = description.info().entity.type;
    this.commands = description.commands();
    this.description = description;
  }

  /**
   * Execute a command on an aggregate (core Service interface)
   */
  async execute(
    name: string,
    target: AggregateId,
    command: Command
  ): Promise<Entity<S>> {
    return this.executeWithOptions(name, target, command, { timeout: 5000 });
  }

  /**
   * Internal method that handles execute with explicit options
   */
  public async executeWithOptions(
    command: string,
    aggregateId: AggregateId,
    payload: Command,
    options: Pick<RequestOptions, "timeout">
  ): Promise<Entity<S>> {
    // Validate command exists
    if (!(command in this.commands)) {
      throw new UnknownCommandError(command, Object.keys(this.commands));
    }

    // Validate command payload against schema
    const schema = this.commands[command];
    const validation = schema.safeParse(payload);
    if (!validation.success) {
      throw new InvalidCommandPayloadError(command, validation.error.message);
    }

    const subject = `${this.type}.execute`;

    const request: ExecuteRequest.Type = {
      target: {
        type: aggregateId.type,
        key: aggregateId.key,
      },
      command,
      payload: validation.data,
      metadata: {
        messageId: ulid(),
        timestamp: new Date().toISOString(),
      },
    };

    try {
      const response = await this.connection.request(subject, JSON.stringify(request), options);

      // Parse response - NATS services automatically throws for error responses
      const data = JSON.parse(new TextDecoder().decode(response.data));

      // Validate successful response
      const responseSchema = ExecuteResponse.schema(this.description.info().entity.schema);
      const parsed = responseSchema.safeParse(data);
      if (!parsed.success) {
        throw new InvalidResponseFormatError("execute", parsed.error.message);
      }

      if (!parsed.data.entity) {
        throw new InvalidResponseFormatError("execute", "missing entity in response");
      }

      return parsed.data.entity as Entity<S>;
    } catch (error) {
      // Handle NATS errors
      if (error instanceof Error) {
        throw mapNatsError(error);
      }
      throw error;
    }
  }

  /**
   * Load an entity by aggregate ID (core Service interface)
   */
  async load(
    aggregate: AggregateId
  ): Promise<Entity<S>> {
    return this.loadWithOptions(aggregate, { timeout: 5000 });
  }

  /**
   * Internal method that handles load with explicit options
   */
  public async loadWithOptions(
    aggregateId: AggregateId,
    options: Pick<RequestOptions, "timeout">
  ): Promise<Entity<S>> {
    const subject = `${this.type}.load`;

    const request: LoadRequest.Type = {
      aggregateId,
    };

    try {
      const response = await this.connection.request(subject, JSON.stringify(request), options);

      // Parse response - NATS services automatically throws for error responses
      const data = JSON.parse(new TextDecoder().decode(response.data));

      // Validate successful response
      const responseSchema = LoadResponse.schema(this.description.info().entity.schema);
      const parsed = responseSchema.safeParse(data);
      if (!parsed.success) {
        throw new InvalidResponseFormatError("load", parsed.error.message);
      }

      if (!parsed.data.entity) {
        throw new InvalidResponseFormatError("load", "missing entity in response");
      }

      return parsed.data.entity as Entity<S>;
    } catch (error) {
      // Handle NATS errors
      if (error instanceof Error) {
        throw mapNatsError(error);
      }
      throw error;
    }
  }

  /**
   * Create a new client with custom timeout
   */
  withTimeout(ms: number): Service<S> {
    return new TimeoutNatsClient(this, ms);
  }

  /**
   * Create a new client with custom headers (placeholder)
   */
  withHeaders(_headers: Record<string, string>): Service<S> {
    // TODO: Implement headers support
    return this;
  }

  /**
   * Create a new client with custom retry settings
   */
  withRetries(maxRetries: number): Service<S> {
    return new RetriesNatsClient(this, maxRetries);
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    await this.connection.close();
  }
}

/**
 * Timeout decorator that applies custom timeout to all requests
 */
class TimeoutNatsClient<S extends State> implements Service<S> {
  constructor(
    private readonly client: NatsClient<S>,
    private readonly timeoutMs: number
  ) {}

  async execute(name: string, target: AggregateId, command: Command): Promise<Entity<S>> {
    return this.client.executeWithOptions(name, target, command, { timeout: this.timeoutMs });
  }

  async load(aggregate: AggregateId): Promise<Entity<S>> {
    return this.client.loadWithOptions(aggregate, { timeout: this.timeoutMs });
  }

  withTimeout(ms: number): Service<S> {
    return new TimeoutNatsClient(this.client, ms);
  }

  withHeaders(_headers: Record<string, string>): Service<S> {
    // TODO: Implement headers + timeout combination
    return this;
  }

  withRetries(maxRetries: number): Service<S> {
    return new RetriesTimeoutNatsClient(this.client, this.timeoutMs, maxRetries);
  }
}

// TODO: Implement headers decorators when NATS headers support is added

/**
 * Retries decorator (placeholder - retry logic would be implemented here)
 */
class RetriesNatsClient<S extends State> implements Service<S> {
  constructor(
    private readonly client: NatsClient<S>,
    private readonly maxRetries: number
  ) {}

  async execute(name: string, target: AggregateId, command: Command): Promise<Entity<S>> {
    // TODO: Implement retry logic
    return this.client.execute(name, target, command);
  }

  async load(aggregate: AggregateId): Promise<Entity<S>> {
    // TODO: Implement retry logic
    return this.client.load(aggregate);
  }

  withTimeout(ms: number): Service<S> {
    return new RetriesTimeoutNatsClient(this.client, ms, this.maxRetries);
  }

  withHeaders(_headers: Record<string, string>): Service<S> {
    // TODO: Implement headers + retries combination
    return this;
  }

  withRetries(maxRetries: number): Service<S> {
    return new RetriesNatsClient(this.client, maxRetries);
  }
}

/**
 * Combined retries and timeout decorator
 */
class RetriesTimeoutNatsClient<S extends State> implements Service<S> {
  constructor(
    private readonly client: NatsClient<S>,
    private readonly timeoutMs: number,
    private readonly maxRetries: number
  ) {}

  async execute(name: string, target: AggregateId, command: Command): Promise<Entity<S>> {
    // TODO: Implement retry logic with timeout
    return this.client.executeWithOptions(name, target, command, { timeout: this.timeoutMs });
  }

  async load(aggregate: AggregateId): Promise<Entity<S>> {
    // TODO: Implement retry logic with timeout
    return this.client.loadWithOptions(aggregate, { timeout: this.timeoutMs });
  }

  withTimeout(ms: number): Service<S> {
    return new RetriesTimeoutNatsClient(this.client, ms, this.maxRetries);
  }

  withHeaders(_headers: Record<string, string>): Service<S> {
    // TODO: Implement headers + retries + timeout combination
    return this;
  }

  withRetries(maxRetries: number): Service<S> {
    return new RetriesTimeoutNatsClient(this.client, this.timeoutMs, maxRetries);
  }
}
