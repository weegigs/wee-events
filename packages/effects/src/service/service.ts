import * as wee from "@weegigs/events-core";

import * as z from "zod";

import * as T from "@effect-ts/core/Effect";
import { pipe } from "@effect-ts/core/Function";
import { Has } from "@effect-ts/core/Has";

import * as s from "../event-store";

import * as d from "./dispatcher";
import * as l from "./loader";

export type State = wee.Payload;

export type ServiceInfo<S extends State> = {
  version: string;
  title?: string;
  description?: string;
  entity: {
    name: string;
    schema: z.Schema<S>;
  };
};

export interface ServiceDescription<R, E, S extends State> {
  info: ServiceInfo<S>;

  commands: d.Dispatcher<R, E, S>["commands"];
  events: l.EntityLoader<S>["events"];

  service(): Service<R, E, S>;
}

export interface Service<R, E, S extends State> {
  execute(
    path: string,
    target: wee.AggregateId,
    command: d.Command
  ): T.Effect<
    R & Has<s.EventLoader>,
    E | d.HandlerNotFound | l.EntityNotAvailableError | s.LoaderError | d.CommandValidationError,
    wee.Entity<S>
  >;

  load(
    aggregate: wee.AggregateId
  ): T.Effect<Has<s.EventLoader>, s.LoaderError | l.EntityNotAvailableError, wee.Entity<S>>;
}

const $make = <R, E, S extends State>(
  dispatcher: d.Dispatcher<R, E, S>,
  loader: l.EntityLoader<S>
): Service<R, E, S> => {
  const execute = (path: string, target: wee.AggregateId, command: d.Command) => {
    const run = pipe(
      T.do,
      T.bind("state", () => loader.load(target)),
      T.bind("_", ({ state }) => dispatcher.dispatch(path, state, command)),
      T.bind("result", () => loader.load(target)),
      T.map(({ result }) => result)
    );

    return run;
  };

  return {
    execute,
    load: loader.load,
  };
};

export const description = <R, E, S extends State>(
  info: ServiceInfo<S>,
  dispatcher: d.Dispatcher<R, E, S>,
  loader: l.EntityLoader<S>
): ServiceDescription<R, E, S> => {
  const service = () => $make(dispatcher, loader);

  return {
    info,
    commands: dispatcher.commands,
    events: loader.events,
    service,
  };
};
