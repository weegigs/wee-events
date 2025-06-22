import { NatsConnection } from "@nats-io/nats-core";
import { connect } from "@nats-io/transport-node";
import { AggregateId, Entity, ServiceDescription, Environment, State, Payload } from "@weegigs/events-core";
import { ulid } from "ulid";

import { ExecuteRequest, ExecuteResponse, FetchRequest, FetchResponse } from "../messages";
import { mapNatsError, UnknownCommandError, InvalidCommandPayloadError, InvalidResponseFormatError } from "./errors";

/**
 * Simple NATS client for event service communication
 */
export class NatsClient<S extends State = State> {
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

  constructor(
    private readonly connection: NatsConnection,
    description: ServiceDescription<Environment, S>
  ) {
    this.type = description.info().entity.type;
    this.commands = description.commands();
  }

  /**
   * Execute a command on an aggregate
   */
  async execute(command: string, aggregateId: AggregateId, payload: Payload): Promise<Entity<S>> {
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

    const subject = `${this.type}.commands.${command}`;

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
      const response = await this.connection.request(subject, JSON.stringify(request), {
        timeout: 5000,
      });

      // Parse response - NATS services automatically throws for error responses
      const data = JSON.parse(new TextDecoder().decode(response.data));

      // Validate successful response
      const parsed = ExecuteResponse.schema.safeParse(data);
      if (!parsed.success) {
        throw new InvalidResponseFormatError("execute", parsed.error.message);
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
   * Fetch an entity by aggregate ID
   */
  async fetch(aggregateId: AggregateId): Promise<Entity<S>> {
    const subject = `${this.type}.fetch`;

    const request: FetchRequest.Type = {
      aggregateId,
    };

    try {
      const response = await this.connection.request(subject, JSON.stringify(request), {
        timeout: 5000,
      });

      // Parse response - NATS services automatically throws for error responses
      const data = JSON.parse(new TextDecoder().decode(response.data));

      // Validate successful response
      const parsed = FetchResponse.schema.safeParse(data);
      if (!parsed.success) {
        throw new InvalidResponseFormatError("fetch", parsed.error.message);
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
   * Close the connection
   */
  async close(): Promise<void> {
    await this.connection.close();
  }
}
