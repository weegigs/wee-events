import { NatsConnection, RequestOptions, headers } from "@nats-io/nats-core";
import { connect } from "@nats-io/transport-node";
import { AggregateId, Entity, ServiceDescription, Environment, State, Command, Service } from "@weegigs/events-core";
import { ulid } from "ulid";

import { ExecuteRequest, ExecuteResponse, LoadRequest, LoadResponse } from "../messages";
import { mapNatsError, UnknownCommandError, InvalidCommandPayloadError, InvalidResponseFormatError } from "./errors";

export type RequestOptionsModifier = (options: RequestOptions) => RequestOptions;

/**
 * NATS client that implements the core Service interface with transport-specific fluent options.
 * 
 * Uses function composition pattern with RequestOptionsModifier to configure transport-level
 * options like timeout and headers. Application-level concerns (retries, circuit breakers, 
 * metrics) should be handled externally using libraries like Cockatiel.
 * 
 * @example
 * ```typescript
 * // Basic usage (Service interface compliance)
 * await client.execute("create-user", userId, userData);
 * await client.load(userId);
 * 
 * // Transport-level configuration
 * await client
 *   .withTimeout(10000)
 *   .withHeader("x-trace-id", "123")
 *   .execute("create-user", userId, userData);
 * 
 * // Application-level policies (external)
 * const resilientClient = Policy.retry().execute(() =>
 *   client.execute("create-user", userId, userData)
 * );
 * ```
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
    description: ServiceDescription<Environment, S>,
    private readonly modifiers: RequestOptionsModifier[] = []
  ) {
    this.type = description.info().entity.type;
    this.commands = description.commands();
    this.description = description;
  }

  /**
   * Execute a command on an aggregate (core Service interface)
   */
  async execute(name: string, target: AggregateId, command: Command): Promise<Entity<S>> {
    if (!(name in this.commands)) {
      throw new UnknownCommandError(name, Object.keys(this.commands));
    }

    // Validate command payload against schema
    const schema = this.commands[name];
    const validation = schema.safeParse(command);
    if (!validation.success) {
      throw new InvalidCommandPayloadError(name, validation.error.message);
    }

    const subject = `${this.type}.execute`;

    const request: ExecuteRequest.Type = {
      target,
      command: name,
      payload: validation.data,
      metadata: {
        messageId: ulid(),
        timestamp: new Date().toISOString(),
      },
    };

    try {
      const options = this.modifiers.reduce((options, modifier) => modifier(options), { timeout: 5000 });
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
   * Apply a custom RequestOptions modifier to create a new client instance.
   * 
   * This is the core composition method that enables the fluent API. Each modifier
   * function receives the current RequestOptions and returns modified options.
   * 
   * @param modifier Function that transforms RequestOptions
   * @returns New NatsClient instance with the modifier applied
   */
  public withModifier(modifier: RequestOptionsModifier): NatsClient<S> {
    return new NatsClient(this.connection, this.description, [...this.modifiers, modifier]);
  }

  /**
   * Load an entity by aggregate ID (core Service interface)
   */
  async load(aggregate: AggregateId): Promise<Entity<S>> {
    const subject = `${this.type}.load`;

    const request: LoadRequest.Type = {
      aggregateId: aggregate,
    };

    try {
      const options = this.modifiers.reduce((options, modifier) => modifier(options), { timeout: 5000 });
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
   * Create a new client with custom NATS request timeout (transport-level).
   * 
   * @param ms Timeout in milliseconds for NATS requests
   * @returns New NatsClient instance with timeout applied
   */
  withTimeout(ms: number): NatsClient<S> {
    return this.withModifier((options) => ({ ...options, timeout: ms }));
  }

  /**
   * Create a new client with an additional NATS header (transport-level).
   * 
   * Headers are sent with the NATS request and can be used for tracing,
   * authentication, or other transport-level metadata.
   * 
   * @param key Header name (any printable ASCII except ':')
   * @param value Header value (any ASCII except '\r' or '\n')
   * @returns New NatsClient instance with header applied
   */
  withHeader(key: string, value: string): NatsClient<S> {
    return this.withModifier((options) => {
      const current = options.headers ?? headers();
      current.append(key, value);
      return { ...options, headers: current };
    });
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    await this.connection.close();
  }
}
