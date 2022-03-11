import * as T from "@effect-ts/core/Effect";

import { tag, Has } from "@effect-ts/core/Has";

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

export const Log = tag<Log>();
export type HasLog = Has<Log>;

export const error = (message: string | Error, context: Record<string, unknown> = {}) =>
  T.accessService(Log)((l) => l.error(message, context));

export const warn = (message: string | Error, context: Record<string, unknown> = {}) =>
  T.accessService(Log)((l) => l.warn(message, context));

export const info = (message: string, context: Record<string, unknown> = {}) =>
  T.accessService(Log)((l) => l.info(message, context));

export const debug = (message: string, context: Record<string, unknown> = {}) =>
  T.accessService(Log)((l) => l.debug(message, context));
