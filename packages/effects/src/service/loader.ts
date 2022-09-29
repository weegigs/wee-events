import * as T from "@effect-ts/core/Effect";
import { Has } from "@effect-ts/core/Has";

import * as store from "../event-store";

import * as wee from "@weegigs/events-core";

import { z } from "zod";
import { pipe } from "@effect-ts/core";
import { DomainEvent, Payload } from "@weegigs/events-core";

type State = wee.Payload;

export type Reducer<A extends Payload, Type extends string, Data extends Payload> = (
  state: A,
  event: wee.RecordedEvent<DomainEvent<Type, Data>>
) => A;

export type Initializer<A extends Payload, Type extends string, Data extends Payload> = (
  event: wee.RecordedEvent<DomainEvent<Type, Data>>
) => A;

export type Init<A extends State> = (id: wee.AggregateId) => A;

export class EntityNotAvailableError extends Error {
  constructor(public readonly aggregate: wee.AggregateId, public readonly type: string) {
    super(`Entity of type ${type} not available from aggregate ${wee.AggregateId.encode(aggregate)}`);
    this.name = "EntityNotAvailableError";

    Object.setPrototypeOf(this, EntityNotAvailableError.prototype);
  }
}

interface InitializedLoader<A extends State> {
  reducer: <Type extends string, Data extends Payload>(
    event: Type,
    schema: z.Schema<Data>,
    reducer: Reducer<A, Type, Data>
  ) => InitializedLoader<A>;

  make(): EntityLoader<A>;
}

interface InitializingLoader<A extends State> extends InitializedLoader<A> {
  initializer<Type extends string, Data extends Payload>(
    event: Type,
    schema: z.Schema<Data>,
    initializer: Initializer<A, Type, Data>
  ): InitializingLoader<A>;
}

export interface EntityLoader<A extends State> {
  load(
    id: wee.AggregateId
  ): T.Effect<Has<store.EventLoader>, store.LoaderError | EntityNotAvailableError, wee.Entity<A>>;
  events(): Record<string, z.Schema>;
}

export interface EntityDescription<A extends State> {
  readonly name: string;
  readonly events: Record<string, z.Schema>;
  readonly schema: z.Schema<A>;
}

type Initializers<A extends State> = Record<
  string,
  { schema: z.Schema<unknown>; initializer: Initializer<A, string, Payload> }
>;

type Reducers<A extends State> = Record<string, { schema: z.Schema<unknown>; reducer: Reducer<A, string, Payload> }>;

export namespace EntityLoader {
  const $make = <A extends State>(loader: $Loader<A>): EntityLoader<A> => {
    const { init, initializers, reducers, type } = loader;

    const replay = (events: wee.RecordedEvent[], state?: A): [A | undefined, wee.Revision] => {
      let result = state;
      let revision = wee.Revision.Initial;

      for (const event of events) {
        if (result === undefined) {
          const { initializer } = initializers[event.type] ?? { initializer: undefined };
          if (initializer !== undefined) {
            result = initializer(event);
            revision = event.revision;
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

    const events: () => Record<string, z.Schema> = () => {
      return {};
    };

    const load = (id: wee.AggregateId) =>
      pipe(
        T.do,
        T.bind("events", () => store.load(id)),
        T.bind("entity", ({ events }) =>
          T.suspend(() => {
            const [state, revision] = replay(events, typeof init == "function" ? init(id) : undefined);
            if (state === undefined) {
              return T.fail(new EntityNotAvailableError(id, type));
            }
            const entity: wee.Entity<A> = {
              aggregate: id,
              type,
              state,
              revision,
            };

            return T.succeed(entity);
          })
        ),
        T.map(({ entity }) => entity)
      );

    return { load, events };
  };

  class $Loader<A extends State> implements InitializedLoader<A> {
    constructor(
      readonly type: string,
      readonly init: (aggregate: wee.AggregateId) => A | undefined,
      readonly initializers: Initializers<A>,
      readonly reducers: Reducers<A>
    ) {}

    reducer<Type extends string, Data extends Payload>(
      event: Type,
      schema: z.Schema<Data>,
      reducer: Reducer<A, Type, Data>
    ): InitializedLoader<A> {
      return new $Loader<A>(this.type, this.init, this.initializers, {
        ...this.reducers,
        [event]: { schema, reducer: reducer as Reducer<A, string, Payload> },
      });
    }

    make(): EntityLoader<A> {
      return $make(this);
    }
  }

  class $Initializing<A extends State> extends $Loader<A> implements InitializingLoader<A> {
    constructor(type: string, initializers: Initializers<A>) {
      super(type, () => undefined, initializers, {});
    }
    initializer<Type extends string, Data extends wee.Payload>(
      event: Type,
      schema: z.ZodType<Data, z.ZodTypeDef, Data>,
      initializer: Initializer<A, Type, Data>
    ): InitializingLoader<A> {
      return new $Initializing<A>(this.type, {
        ...this.initializers,
        [event]: { schema, initializer: initializer as Initializer<A, string, Payload> },
      });
    }
  }

  export const init = <A extends State>(type: string, init: Init<A>): InitializedLoader<A> => {
    const loader = new $Loader<A>(type, init, {}, {});
    return loader;
  };

  export const initializer = <A extends State, Type extends string, Data extends Payload>(
    type: string,
    event: Type,
    schema: z.ZodType<Data, z.ZodTypeDef, Data>,
    initializer: Initializer<A, Type, Data>
  ): InitializingLoader<A> => {
    return new $Initializing<A>(type, {
      [event]: { schema, initializer: initializer as Initializer<A, string, Payload> },
    });
  };
}
