import _ from "lodash";
import { z } from "zod";

import * as store from "../store";
import { AggregateId, DomainEvent, Entity, Payload, RecordedEvent, Revision } from "../types";
import { State } from "./state";

export interface EntityLoader<A extends State> {
  load(id: AggregateId): Promise<Entity<A>>;
}

export type EntityDescription<S extends State> = { type: string; schema: z.ZodType<S, z.ZodTypeDef, S> };

export type LoaderDescription<S extends State> = {
  entity(): EntityDescription<S>;
  events(): Record<string, z.Schema>;

  create: (store: store.EventStore) => EntityLoader<S>;
};

export type Reducer<A extends State, Event extends DomainEvent> = (state: A, event: RecordedEvent<Event>) => A;
export type Initializer<A extends State, Event extends DomainEvent> = (event: RecordedEvent<Event>) => A;

export class EntityNotAvailableError extends Error {
  constructor(public readonly aggregate: AggregateId, public readonly type: string) {
    super(`Entity of type ${type} not available from aggregate ${AggregateId.encode(aggregate)}`);
    this.name = "EntityNotAvailableError";

    Object.setPrototypeOf(this, EntityNotAvailableError.prototype);
  }
}

export namespace LoaderDescription {
  type Initializers<A extends State> = Record<
    string,
    { schema: z.Schema<unknown>; initializer: Initializer<A, DomainEvent> }
  >;

  type Reducers<A extends State> = Record<string, { schema: z.Schema<unknown>; reducer: Reducer<A, DomainEvent> }>;

  class Components<A extends State> {
    constructor(
      readonly entity: EntityDescription<A>,
      readonly init: ((aggregate: AggregateId) => A) | undefined,
      readonly initializers: Initializers<A>,
      readonly reducers: Reducers<A>
    ) {}
  }

  const $create = <A extends State>(components: Components<A>): LoaderDescription<A>["create"] => {
    return (store: store.EventStore) => {
      const {
        init,
        initializers,
        reducers,
        entity: { type },
      } = components;

      const replay = (events: RecordedEvent[], state?: A): [A | undefined, Revision] => {
        let result = state;
        let revision = Revision.Initial;

        for (const event of events) {
          if (result === undefined) {
            const { initializer } = initializers[event.type] ?? { initializer: undefined };
            if (initializer !== undefined) {
              result = initializer(event);
              if (result !== undefined) {
                revision = event.revision;
              }
            }
          } else {
            const { reducer } = reducers[event.type] ?? { reducer: undefined };
            if (reducer !== undefined) {
              result = reducer(result, event);
              revision = event.revision;
            }
          }
        }

        return [result, revision];
      };

      const load = async (id: AggregateId) => {
        const events = await store.load(id);
        const [state, revision] = replay(events, typeof init == "function" ? init(id) : undefined);
        if (state === undefined) {
          throw new EntityNotAvailableError(id, type);
        }
        const entity: Entity<A> = {
          aggregate: id,
          type,
          state,
          revision,
        };

        return entity;
      };

      return { load };
    };
  };

  function $events<A extends State>(components: Components<A>): Record<string, z.Schema> {
    const { initializers, reducers } = components;

    return _.merge(
      {},
      ...Object.entries(initializers).map(([event, { schema }]) => ({ [event]: schema })),
      ...Object.entries(reducers).map(([event, { schema }]) => ({ [event]: schema }))
    );
  }

  function $make<A extends State>(components: Components<A>): LoaderDescription<A> {
    const { entity } = components;

    const create = $create(components);
    const events = $events(components);

    return { entity: () => entity, events: () => events, create };
  }

  interface Initialized<A extends State> {
    description(): LoaderDescription<A>;
    reducer<Type extends string, Data extends Payload>(
      event: Type,
      schema: z.Schema<Data>,
      reducer: Reducer<A, DomainEvent<Type, Data>>
    ): Initialized<A>;
  }

  class $Initialized<A extends State> extends Components<A> implements Initialized<A> {
    reducer<Type extends string, Data extends Payload>(
      event: Type,
      schema: z.Schema<Data>,
      reducer: Reducer<A, DomainEvent<Type, Data>>
    ): Initialized<A> {
      return new $Initialized<A>(this.entity, this.init, this.initializers, {
        ...this.reducers,
        [event]: { schema, reducer: reducer as Reducer<A, DomainEvent> },
      });
    }

    description(): LoaderDescription<A> {
      return $make(this);
    }
  }

  interface Initializing<A extends State> extends Initialized<A> {
    initializer<Type extends string, Data extends Payload>(
      event: Type,
      schema: z.ZodType<Data, z.ZodTypeDef, Data>,
      initializer: Initializer<A, DomainEvent<Type, Data>>
    ): Initializing<A>;
  }

  class $Initializing<A extends State> extends $Initialized<A> implements Initializing<A> {
    initializer<Type extends string, Data extends Payload>(
      event: Type,
      schema: z.ZodType<Data, z.ZodTypeDef, Data>,
      initializer: Initializer<A, DomainEvent<Type, Data>>
    ): $Initializing<A> {
      return new $Initializing<A>(
        this.entity,
        this.init,
        {
          ...this.initializers,
          [event]: { schema, initializer: initializer as Initializer<A, DomainEvent> },
        },
        this.reducers
      );
    }
  }

  export const fromInitFunction = <A extends State>(
    entity: { type: string; schema: z.ZodType<A, z.ZodTypeDef, A> },
    init: (aggregate: AggregateId) => A
  ): Initialized<A> => {
    return new $Initialized(entity, init, {}, {});
  };

  export const fromInitializer = <A extends State, Type extends string, Data extends Payload>(
    entity: { type: string; schema: z.ZodType<A, z.ZodTypeDef, A> },
    event: Type,
    schema: z.ZodType<Data, z.ZodTypeDef, Data>,
    initializer: Initializer<A, DomainEvent<Type, Data>>
  ): Initializing<A> => {
    return new $Initializing<A>(
      entity,
      undefined,
      {
        [event]: { schema, initializer: initializer as Initializer<A, DomainEvent> },
      },
      {}
    );
  };
}
