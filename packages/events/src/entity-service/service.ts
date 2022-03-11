import { Command, Payload } from "../types";

import { createDispatcher, createLoader, createService } from "./factory";
import { Dispatcher } from "../dispatcher";
import { Loader } from "../loader";

export interface EntityService<S extends Payload> extends Dispatcher<S, Command>, Loader<S> {}

export namespace EntityService {
  export const create = createService;
}

export const loader = createLoader;
export const dispatcher = createDispatcher;
