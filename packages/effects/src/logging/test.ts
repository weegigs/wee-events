import * as T from "@effect-ts/core/Effect";
import * as L from "@effect-ts/core/Effect/Layer";
import { Log } from "./effects";

export type Sink = (level: string, message: string | Error, context?: Record<string, unknown>) => void;

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const noop: Sink = () => {};

export class TestLogger implements Log {
  #sink: Sink;
  #context: Record<string, unknown>;

  constructor(sink: Sink = noop, context: Record<string, unknown> = {}) {
    this.#sink = sink;
    this.#context = context;
  }

  child(context: Record<string, unknown> = {}): Log {
    return new TestLogger(this.#sink, { ...this.#context, ...context });
  }

  data(message: string | Error, context: Record<string, unknown> = {}): void {
    this.#sink("data", message, { ...this.#context, ...context });
  }
  debug(message: string | Error, context: Record<string, unknown> = {}): void {
    this.#sink("debug", message, { ...this.#context, ...context });
  }
  error(message: string | Error, context: Record<string, unknown> = {}): void {
    this.#sink("error", message, { ...this.#context, ...context });
  }
  fatal(message: string | Error, context: Record<string, unknown> = {}): void {
    this.#sink("fatal", message, { ...this.#context, ...context });
  }
  info(message: string | Error, context: Record<string, unknown> = {}): void {
    this.#sink("info", message, { ...this.#context, ...context });
  }
  silent(message: string | Error, context: Record<string, unknown> = {}): void {
    this.#sink("silent", message, { ...this.#context, ...context });
  }
  trace(message: string | Error, context: Record<string, unknown> = {}): void {
    this.#sink("trace", message, { ...this.#context, ...context });
  }
  warn(message: string | Error, context: Record<string, unknown> = {}): void {
    this.#sink("data", message, { ...this.#context, ...context });
  }
}

export const test = L.fromEffect(Log)(T.succeed(new TestLogger()));
