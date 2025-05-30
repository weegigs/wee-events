import * as Effect from "effect/Effect";
import * as Context from "effect/Context";

export interface Log {
  child(context?: Record<string, unknown>): Log;

  data(message: string | Error, context?: Record<string, unknown>): void;
  debug(message: string | Error, context?: Record<string, unknown>): void;
  error(message: string | Error, context?: Record<string, unknown>): void;
  fatal(message: string | Error, context?: Record<string, unknown>): void;
  info(message: string | Error, context?: Record<string, unknown>): void;
  silent(message: string | Error, context?: Record<string, unknown>): void;
  trace(message: string | Error, context?: Record<string, unknown>): void;
  warn(message: string | Error, context?: Record<string, unknown>): void;
}

export const Log = Context.GenericTag<Log>("Log");

export const error = (message: string | Error, context: Record<string, unknown> = {}) =>
  Effect.flatMap(Log, (l) => Effect.sync(() => l.error(message, context)));

export const warn = (message: string | Error, context: Record<string, unknown> = {}) =>
  Effect.flatMap(Log, (l) => Effect.sync(() => l.warn(message, context)));

export const info = (message: string, context: Record<string, unknown> = {}) =>
  Effect.flatMap(Log, (l) => Effect.sync(() => l.info(message, context)));

export const debug = (message: string, context: Record<string, unknown> = {}) =>
  Effect.flatMap(Log, (l) => Effect.sync(() => l.debug(message, context)));
