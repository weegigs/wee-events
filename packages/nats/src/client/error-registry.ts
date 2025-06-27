import { NatsServiceErrorPayload } from "../errors";

// Type for a function that creates an error from its serialized details.
export type ErrorFactory = (message: string, details: Record<string, unknown>) => Error;

class ErrorFactoryRegistry {
  private factories = new Map<string, ErrorFactory>();

  public register(name: string, factory: ErrorFactory): void {
    this.factories.set(name, factory);
  }

  public reconstitute(payload: NatsServiceErrorPayload): Error {
    const { name, message, details } = payload.error;
    const factory = this.factories.get(name);

    if (factory && details) {
      return factory(message, details); // Delegate creation to the factory.
    }

    // Fallback for unregistered errors or errors with no details.
    return new Error(`[${name}] ${message}`);
  }
}

export const errorRegistry = new ErrorFactoryRegistry();
