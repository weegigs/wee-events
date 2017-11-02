import * as R from "ramda";

import { AggregateId, CommandResult, ErrorResult } from "./types";

export function aggregateKey(id: AggregateId): string {
  return `${id.type}:${id.id}`;
}

export function hasErrors(result: CommandResult): result is ErrorResult {
  return R.has("errors", result);
}
