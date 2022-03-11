import { nanoid } from "nanoid";

import { EventStore } from "../store";
import { AggregateId, Command, DomainEvent, Entity, Payload, RecordedEvent } from "../types";
import { Loader } from "../loader";
import { Dispatcher } from "../dispatcher";

import { EntityService } from "./service";
import { revisionFor } from "./helpers";
import { CommandHandler, Creator, Initializer, Reducer } from "./types";

const createPublisher = (store: EventStore, command: Command) => {
  let _triggered = false;

  const publish: EventStore.Publisher = async (
    aggregate: AggregateId,
    events: DomainEvent | DomainEvent[],
    options?: EventStore.PublishOptions
  ) => {
    const correlationId = options?.correlationId ?? `${command.name}/${nanoid(26)}`;
    const result = await store.publish(aggregate, events, { ...options, correlationId });

    _triggered = true;

    return result;
  };

  const triggered = () => _triggered;

  return { publish, triggered };
};

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

    const { publish, triggered } = createPublisher(store, command);

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

    return triggered() ? loader.load(aggregate) : entity;
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

export const createCommandDispatcher = <S extends Payload, C extends Command>({
  store,
  loader,
  handler,
}: {
  store: EventStore;
  type: string;
  loader: Loader<S>;
  handler: CommandHandler<S, C>;
}): Dispatcher<S, C> => {
  const execute = async (aggregate: AggregateId, command: C): Promise<Entity<S> | undefined> => {
    const entity = await loader.load(aggregate);
    if (entity === undefined) {
      throw new Error(`no entity found for aggregate ${aggregate}`);
    }

    const { publish, triggered } = createPublisher(store, command);

    await handler(command, entity, publish);

    return triggered() ? loader.load(aggregate) : entity;
  };

  return { execute };
};

export const createCreatorDispatcher = <S extends Payload, C extends Command>({
  store,
  loader,
  creator,
}: {
  store: EventStore;
  type: string;
  loader: Loader<S>;
  creator: Creator<C>;
}): Dispatcher<S, C> => {
  const execute = async (aggregate: AggregateId, command: C): Promise<Entity<S> | undefined> => {
    const entity = await loader.load(aggregate);
    if (entity !== undefined) {
      throw new Error(`entity exists for aggregate ${aggregate}`);
    }

    const { publish, triggered } = createPublisher(store, command);
    await creator(command, aggregate, publish);

    return triggered() ? loader.load(aggregate) : undefined;
  };

  return { execute };
};
