import _ from "lodash";

import { sleep } from "./sleep";

const defaults = {
  limit: 10,
  delay: 197,
};

// KAO based on full jitter from https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
function jitter(delay: number, iteration: number) {
  const base = (delay * 2 ** (iteration - 1)) / 2;
  return Math.ceil(base + Math.random() * base);
}

export const MAX_LIMIT = 31;
export const DEFAULT_SHOULD_RETRY: <T>(result: T | Error) => boolean | number = (v) => _.isError(v);

export function chained<T>(
  attempt: () => Promise<T>,
  shouldRetry: (result: T | Error) => boolean | number = DEFAULT_SHOULD_RETRY,
  options: Partial<retry.Options> = {}
): Promise<T> {
  const { limit, delay } = { ...defaults, ...options };

  if (limit > MAX_LIMIT) {
    throw new Error(`limit must be <= ${MAX_LIMIT}`);
  }

  const next = (outcome: "resolved" | "rejected", iteration: number, result: T | Error): Promise<T> => {
    const retry = shouldRetry(result);
    if (!retry || iteration >= limit - 1) {
      return new Promise<T>((resolve, reject) => {
        return outcome === "resolved" ? resolve(result as T) : reject(result);
      });
    }

    return new Promise<T>((resolve, reject) => {
      const time = typeof retry === "boolean" ? jitter(delay, iteration) : delay;
      sleep(time).then(attempt).then(resolve).catch(reject);
    });
  };

  let result = attempt();
  for (let i = 0; i < Math.max(limit, 1); i++) {
    result = result.then(
      (v) => next("resolved", i, v),
      (e) => next("rejected", i, e)
    );
  }

  return result;
}

export namespace retry {
  export type Options = {
    limit: number;
    delay: number;
  };
}

export const retry = chained;
