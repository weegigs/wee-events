import * as wee from "@weegigs/events-core";

import * as z from "zod";

import * as Effect from "effect/Effect";

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
  ): Effect.Effect<
    wee.Entity<S>,
    E | d.HandlerNotFound | l.EntityNotAvailableError | s.LoaderError | d.CommandValidationError,
    R | s.EventLoader
  >;

  load(
    aggregate: wee.AggregateId
  ): Effect.Effect<wee.Entity<S>, s.LoaderError | l.EntityNotAvailableError, s.EventLoader>;
}

const $make = <R, E, S extends State>(
  dispatcher: d.Dispatcher<R, E, S>,
  loader: l.EntityLoader<S>
): Service<R, E, S> => {
  const execute = (path: string, target: wee.AggregateId, command: d.Command) => {
    return Effect.gen(function* () {
      const state = yield* loader.load(target);
      yield* dispatcher.dispatch(path, state, command);
      const result = yield* loader.load(target);
      return result;
    });
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
