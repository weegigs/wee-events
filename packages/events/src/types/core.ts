import * as z from "zod";

export type Primitive = string | number | boolean;
export type Value = Primitive | Payload | List;
export type EmptyPayload = { [member: string]: never };
export type Payload = { [member: string]: Value } | EmptyPayload;
export type List = Primitive[] | Payload[] | List[];

export namespace Payload {
  const primitive = z.union([z.string(), z.number(), z.boolean()]);
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  const list: z.Schema<List> = z.lazy(() => z.union([z.array(primitive), z.array(payload), z.array(list)]));
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  const value: z.Schema<Value> = z.lazy(() => z.union([primitive, list, payload]));
  const payload: z.Schema<Payload> = z.lazy(() => z.record(value));

  export const schema = payload;
  export const parse = (value: unknown): Payload => schema.parse(value);
}

export namespace EmptyPayload {
  export const schema = z.record(z.never());
}

export type AggregateId<Type extends string = string> = {
  type: Type;
  key: string;
};

export namespace AggregateId {
  export const schema = <Type extends string>(type: Type): z.Schema<AggregateId<Type>> =>
    z.object({
      type: z.literal(type),
      key: z.string().min(1),
    }) as unknown as z.Schema<AggregateId<Type>>;

  export const encode = (aggregate: AggregateId): string => `${aggregate.type}.${aggregate.key}`;
  export const decoder =
    (type: string) =>
    (aggregate: string): AggregateId => {
      const [_type, ...key] = aggregate.split(".");
      return schema(type).parse({ type: _type, key: key.join(".") });
    };

  export const parser =
    <Type extends string>(type: Type) =>
    (value: unknown) =>
      schema(type).parse(value);
}

export interface DomainEvent<Type extends string = string, Data extends Payload = Payload> {
  type: Type;
  data: Data;
}

export namespace DomainEvent {
  export const schema = z.object({
    type: z.string().min(1),
    data: Payload.schema,
  });
}

export interface RecordedEvent<E extends DomainEvent = DomainEvent> {
  /**
   * The aggregate that events belongs to.
   */
  aggregate: AggregateId;

  /**
   * The revision for the aggregate.
   */
  revision: string;

  /**
   * Unique identifier representing this event. ULID format.
   */
  id: string;

  /**
   * Type of this event.
   */
  type: E["type"];

  /**
   * Representing when this event was created in the database system.
   */
  timestamp: string;

  /**
   * Data of this event.
   */
  data: E["data"];

  /**
   * Representing the metadata associated with this event.
   */
  metadata: RecordedEvent.Metadata;
}

export namespace RecordedEvent {
  export type Metadata = {
    causationId?: string;
    correlationId?: string;
  };
}

export interface Command<Name extends string = string, Data extends Payload = Payload> {
  name: Name;
  data: Data;
}

export namespace Command {
  export const schema = <Name extends string = string, Data extends Payload = Payload>(
    name: string,
    schema: z.Schema<Data>
  ): z.Schema<Command<Name, Data>> => {
    return z.object({
      name: z.literal(name),
      data: schema,
    }) as unknown as z.Schema<Command<Name, Data>>;
  };

  export const validator = <Name extends string = string, Data extends Payload = Payload>(
    name: string,
    schema: z.Schema<Data>
  ): ((value: unknown) => value is Command<Name, Data>) => {
    const _schema = Command.schema(name, schema);

    return (value: unknown): value is Command<Name, Data> => {
      return _schema.safeParse(value).success;
    };
  };

  export const parser = <Name extends string = string, Data extends Payload = Payload>(
    name: string,
    schema: z.Schema<Data>
  ): ((value: unknown) => Command<Name, Data>) => {
    const _schema = Command.schema(name, schema);

    return (value: unknown): Command<Name, Data> => {
      return _schema.parse(value) as Command<Name, Data>;
    };
  };

  const _rawSchema: z.Schema<Command> = z.object({
    name: z.string().min(1),
    data: Payload.schema,
  });

  export const parse = (value: unknown): Command => {
    return _rawSchema.parse(value);
  };

  export const factory =
    <Name extends string, Data extends Payload>(name: Name, schema: z.Schema<Data>) =>
    (data: Data): Command<Name, Data> =>
      parser<Name, Data>(name, schema)(data);
}

export type Revision = string;

export namespace Revision {
  export type Initial = "00000000000000000000000000";
  export const Initial = "00000000000000000000000000";

  export const isInitial = (revision: Revision): boolean => revision === Initial;

  export const schema = z.string().min(26).max(26);
}
