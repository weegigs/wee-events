import { nanoid } from "nanoid";

import { EventStore } from "../store";
import { AggregateId, Command, DomainEvent, Entity, Payload, RecordedEvent } from "../types";

import { EntityService } from "./service";
import { revisionFor } from "./helpers";
import { CommandHandler, Creator, Initializer, Reducer } from "./types";
import { Loader } from "../loader";
import { Dispatcher } from "..";

export const createLoader = <S extends Payload>({
  store,
  type,
  init,
  initializers,
  reducers,
}: {
  store: EventStore;
  type: string;
  init?: ((aggregate: AggregateId) => S) | undefined;
  initializers: Record<string, Initializer<S, DomainEvent>>;
  reducers: Record<string, Reducer<S, DomainEvent>>;
}): Loader<S> => {
  const replay = (events: RecordedEvent[], state?: S): S | undefined => {
    let result = state;

    for (const event of events) {
      if (result === undefined) {
        const handler = initializers[event.type];
        if (handler !== undefined) {
          result = handler(event) as S;
        }
      } else {
        const handler = reducers[event.type];
        if (handler !== undefined) {
          result = handler(result, event) as S;
        }
      }
    }

    return result;
  };

  const load = async (aggregate: AggregateId): Promise<Entity<S> | undefined> => {
    const events = await store.load(aggregate);
    const state = replay(events, init ? init(aggregate) : undefined);

    if (state === undefined) {
      return undefined;
    }

    const revision = revisionFor(events);

    return {
      aggregate,
      type,
      state: state,
      revision,
    };
  };

  return { load };
};

export const createDispatcher = <S extends Payload>({
  store,
  loader,
  creators,
  handlers,
}: {
  store: EventStore;
  type: string;
  loader: Loader<S>;
  creators: Record<string, Creator<Command>>;
  handlers: Record<string, CommandHandler<S, Command>>;
}): Dispatcher<S, Command> => {
  const execute = async (aggregate: AggregateId, command: Command): Promise<Entity<S> | undefined> => {
    const entity = await loader.load(aggregate);

    const publish: EventStore.Publisher = (
      aggregate: AggregateId,
      events: DomainEvent | DomainEvent[],
      options?: EventStore.PublishOptions
    ) => {
      const correlationId = options?.correlationId ?? `${command.name}/${nanoid(26)}`;
      return store.publish(aggregate, events, { ...options, correlationId });
    };

    if (entity === undefined) {
      const handler = creators[command.name];
      if (handler === undefined) {
        throw new Error(`no creator found for command ${command.name}`);
      }

      await handler(command, aggregate, publish);
    } else {
      const handler = handlers[command.name];
      if (handler === undefined) {
        throw new Error(`no handler found for command ${command.name}`);
      }

      await handler(command, entity, publish);
    }

    return loader.load(aggregate);
  };

  return { execute };
};

export const createService = <S extends Payload>({
  store,
  type,
  init,
  initializers,
  reducers,
  creators,
  handlers,
}: {
  store: EventStore;
  type: string;
  init?: ((aggregate: AggregateId) => S) | undefined;
  initializers: Record<string, Initializer<S, DomainEvent>>;
  reducers: Record<string, Reducer<S, DomainEvent>>;
  creators: Record<string, Creator<Command>>;
  handlers: Record<string, CommandHandler<S, Command>>;
}): EntityService<S> => {
  const loader = createLoader<S>({ store, type, init, initializers, reducers });
  const dispatcher = createDispatcher<S>({ store, type, loader, creators, handlers });

  return { ...loader, ...dispatcher };
};
