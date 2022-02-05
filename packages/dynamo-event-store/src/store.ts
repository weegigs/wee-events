import _ from "lodash";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand, QueryCommandOutput } from "@aws-sdk/lib-dynamodb";

import { ChangeSet } from "./changeset";

import {
  isClockSkewError,
  isRetryableByTrait,
  isThrottlingError,
  isTransientError,
} from "@aws-sdk/service-error-classification";

import { retry } from "@weegigs/events-common";
import { Cypher, Tokenizer, no } from "@weegigs/events-cypher";

import {
  DomainEvent,
  EventStore,
  RecordedEvent,
  Revision,
  AggregateId,
  ExpectedRevisionConflictError,
  RevisionConflictError,
} from "@weegigs/wee-events";

export namespace DynamoEventStore {
  export interface Options {
    client: () => DynamoDBDocumentClient;
    cypher: Cypher;
    tokenizer: Tokenizer;
  }
}

const defaults: DynamoEventStore.Options = {
  client: () =>
    DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    }),
  cypher: no.cypher,
  tokenizer: no.tokenizer,
};

type LatestRecord = {
  pk: string;
  sk: string;
  revision: string;
};

function latestFor(changeSet: ChangeSet): LatestRecord {
  return {
    pk: changeSet.pk,
    sk: `latest-revision`,
    revision: changeSet.revision,
  };
}

function latestCondition(changeset: ChangeSet, expectedVersion?: string) {
  if (undefined === expectedVersion) {
    return {
      ConditionExpression: "attribute_not_exists(#revision) Or #revision < :revision",
      ExpressionAttributeNames: { "#revision": "revision" },
      ExpressionAttributeValues: { ":revision": changeset.revision },
    };
  }

  if (expectedVersion === Revision.Initial) {
    return {
      ConditionExpression: "attribute_not_exists(#revision)",
      ExpressionAttributeNames: { "#revision": "revision" },
    };
  }

  return {
    ConditionExpression: "#revision = :revision",
    ExpressionAttributeNames: { "#revision": "revision" },
    ExpressionAttributeValues: { ":revision": expectedVersion },
  };
}

const isRetryableError = (error: Error) => {
  return isRetryableByTrait(error) || isClockSkewError(error) || isThrottlingError(error) || isTransientError(error);
};

const isConditionCheckFailed = (error: Error) =>
  error.name === "TransactionCanceledException" &&
  (error as any).CancellationReasons?.[0]?.Code === "ConditionalCheckFailed";

export class DynamoEventStore implements EventStore {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;
  readonly #encoder: ChangeSet.EventEncoder;
  readonly #decoder: ChangeSet.ChangeSetDecoder;

  constructor(table: string, options: Partial<DynamoEventStore.Options> = {}) {
    const { client, cypher, tokenizer } = { ...defaults, ...options };

    this.#client = client();
    this.#table = table;
    this.#encoder = ChangeSet.encoder(cypher, tokenizer);
    this.#decoder = ChangeSet.decoder(cypher);
  }

  #read = async (
    key: string,
    decrypt: boolean,
    _after?: Revision,
    cursor: any = undefined
  ): Promise<{ events: RecordedEvent[]; next: any }> => {
    const query = new QueryCommand({
      TableName: this.#table,
      ScanIndexForward: true,
      ExclusiveStartKey: cursor,
      KeyConditionExpression: "#pk = :aggregate And begins_with(#sk, :change_set_prefix)",
      ExpressionAttributeNames: {
        "#pk": "pk",
        "#sk": "sk",
      },
      ExpressionAttributeValues: {
        ":aggregate": key,
        ":change_set_prefix": "change-set#",
      },
    });

    const { Items, LastEvaluatedKey } = await retry(
      async () => this.#client.send(query),
      (e: Error | QueryCommandOutput) => {
        return _.isError(e) ? isRetryableError(e) : false;
      },
      { limit: 5, delay: 37 }
    );

    const events: RecordedEvent[][] = await Promise.all(
      (Items ?? [])
        .map((item: any) => ChangeSet.schema.parse(item))
        .map((changeSet) => this.#decoder(changeSet, decrypt))
    );

    return { events: events.flat(), next: LastEvaluatedKey };
  };

  async load(aggregate: AggregateId, options: EventStore.LoadOptions = {}): Promise<RecordedEvent[]> {
    const key = AggregateId.encode(aggregate);
    const { decrypt, afterRevision: after } = { decrypt: false, ...options };

    let events: RecordedEvent[] = [];
    let cursor: any | undefined = undefined;
    do {
      const { events: page, next } = await retry(
        () => this.#read(key, decrypt, after, cursor),
        (result) => _.isError(result) && isRetryableError(result)
      );

      events = events.concat(page);
      cursor = next;
    } while (cursor);

    return events;
  }

  async publish(
    aggregate: AggregateId,
    events: DomainEvent | DomainEvent[],
    options: EventStore.PublishOptions = {}
  ): Promise<Revision> {
    const _events = Array.isArray(events) ? events : [events];
    if (_events.length === 0) {
      throw new Error(`expected at least one event to be published`);
    }

    const { encrypt, expectedRevision } = options;
    const recorded: RecordedEvent[] = await Promise.all(
      _events
        .map((event) => DomainEvent.schema.parse(event))
        .map((event) =>
          this.#encoder(aggregate, event, _.pick(options, "correlationId", "causationId"), encrypt ?? false)
        )
    );

    const changeSet = await ChangeSet.create(aggregate, recorded);
    await this.#write(changeSet, expectedRevision);

    return changeSet.revision;
  }

  async #write(changeSet: ChangeSet, expectedRevision?: string): Promise<Revision> {
    const TableName = this.#table;

    const latest = latestFor(changeSet);
    const latestCheck = latestCondition(changeSet, expectedRevision);

    const write = new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName,
            Item: latest,
            ...latestCheck,
          },
        },
        {
          Put: {
            TableName,
            Item: changeSet,
          },
        },
      ],
    });

    try {
      await retry(
        async () => {
          await this.#client.send(write);
        },
        (e: Error | void) => {
          if (!_.isError(e)) {
            return false;
          }

          if (
            e.name === "TransactionCanceledException" &&
            (e as any).CancellationReasons?.[0]?.Code === "ConditionalCheckFailed"
          ) {
            return expectedRevision === undefined;
          }

          return isRetryableError(e);
        },
        { limit: 5, delay: 37 }
      );
    } catch (e: any) {
      if (isConditionCheckFailed(e)) {
        if (expectedRevision !== undefined) {
          throw new ExpectedRevisionConflictError(expectedRevision);
        }

        throw new RevisionConflictError();
      }

      throw e;
    }

    return changeSet.revision;
  }
}
