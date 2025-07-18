import _ from "lodash";
import * as z from "zod";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { retry, handleWhen, ExponentialBackoff } from "cockatiel";

import { ChangeSet } from "./changeset";
import { Cypher, Tokenizer, no } from "@weegigs/events-cypher";

import {
  DomainEvent,
  EventStore,
  RecordedEvent,
  Revision,
  AggregateId,
  ExpectedRevisionConflictError,
  RevisionConflictError,
  Payload,
} from "@weegigs/events-core";

// AWS error type definitions
interface AWSError extends Error {
  name: string;
  retryable?: boolean;
  CancellationReasons?: Array<{ Code?: string }>;
}

// Simple error classification functions
const isRetryableByTrait = (error: unknown): error is AWSError => {
  const awsError = error as AWSError;
  return awsError?.retryable === true;
};

const isClockSkewError = (error: unknown): error is AWSError => {
  const awsError = error as AWSError;
  return awsError?.name === "ClockSkew";
};

const isThrottlingError = (error: unknown): error is AWSError => {
  const awsError = error as AWSError;
  return awsError?.name === "ThrottlingException" || awsError?.name === "ProvisionedThroughputExceededException";
};

const isTransientError = (error: unknown): error is AWSError => {
  const awsError = error as AWSError;
  return awsError?.name === "ServiceUnavailable" || awsError?.name === "InternalServerError";
};

const isRetryableError = (error: unknown): boolean => {
  return (
    _.isError(error) &&
    (isRetryableByTrait(error) || isClockSkewError(error) || isThrottlingError(error) || isTransientError(error))
  );
};

const isConditionCheckFailed = (error: unknown): error is AWSError => {
  const awsError = error as AWSError;
  return (
    awsError?.name === "TransactionCanceledException" &&
    awsError.CancellationReasons?.[0]?.Code === "ConditionalCheckFailed"
  );
};

// --- Retry Policies ---

const readRetryPolicy = retry(handleWhen(isRetryableError), {
  maxAttempts: 5,
  backoff: new ExponentialBackoff({ initialDelay: 50, maxDelay: 1000 }),
});

const createPublishRetryPolicy = (expectedRevision?: string) =>
  retry(
    handleWhen((e: unknown) => {
      if (!_.isError(e)) {
        return false;
      }
      // If the condition check failed, we only want to retry if we weren't expecting a specific revision.
      // This handles the "put if not exists" scenario where a concurrent write might have just created the record.
      if (isConditionCheckFailed(e)) {
        return expectedRevision === undefined;
      }
      // For all other errors, use the standard retryable logic.
      return isRetryableError(e);
    }),
    {
      maxAttempts: 5,
      backoff: new ExponentialBackoff({ initialDelay: 50, maxDelay: 1000 }),
    }
  );

// --- DynamoEventStore Implementation ---

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
  timestamp: string;
};

function latestFor(changeSet: ChangeSet): LatestRecord {
  return {
    pk: changeSet.pk,
    sk: `latest-revision`,
    revision: changeSet.revision,
    timestamp: changeSet.timestamp,
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

export class DynamoEventStore implements EventStore {
  private readonly $client: DynamoDBDocumentClient;
  private readonly $table: string;
  private readonly $encoder: ChangeSet.EventEncoder;
  private readonly $decoder: ChangeSet.ChangeSetDecoder;

  constructor(table: string, options: Partial<DynamoEventStore.Options> = {}) {
    const { client, cypher, tokenizer } = { ...defaults, ...options };

    this.$client = client();
    this.$table = table;
    this.$encoder = ChangeSet.encoder(cypher, tokenizer);
    this.$decoder = ChangeSet.decoder(cypher);
  }

  private $read = async (
    key: string,
    decrypt: boolean,
    _after?: Revision,
    cursor?: Record<string, unknown>
  ): Promise<{ events: RecordedEvent[]; next?: Record<string, unknown> }> => {
    const query = new QueryCommand({
      TableName: this.$table,
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

    const { Items, LastEvaluatedKey } = await readRetryPolicy.execute(() => this.$client.send(query));

    const events: RecordedEvent[][] = await Promise.all(
      (Items ?? [])
        .map((item: Record<string, unknown>) => ChangeSet.schema.parse(item))
        .map((changeSet: ChangeSet) => this.$decoder(changeSet, decrypt))
    );

    const result: { events: RecordedEvent[]; next?: Record<string, unknown> } = {
      events: events.flat(),
    };

    if (LastEvaluatedKey) {
      result.next = LastEvaluatedKey as Record<string, unknown>;
    }

    return result;
  };

  load = async (aggregate: AggregateId, options: EventStore.LoadOptions = {}): Promise<RecordedEvent[]> => {
    const key = AggregateId.encode(aggregate);
    const { decrypt, afterRevision: after } = { decrypt: false, ...options };

    let events: RecordedEvent[] = [];
    let cursor: Record<string, unknown> | undefined = undefined;
    do {
      // The retry policy is now inside the $read method, so we don't need to wrap the call here.
      const { events: page, next } = await this.$read(key, decrypt, after, cursor);

      events = events.concat(page);
      cursor = next;
    } while (cursor);

    return events;
  };

  publish = async (
    aggregate: AggregateId,
    events: DomainEvent | DomainEvent[],
    options: EventStore.PublishOptions = {}
  ): Promise<Revision> => {
    const _events = Array.isArray(events) ? events : [events];
    if (_events.length === 0) {
      throw new Error(`expected at least one event to be published`);
    }

    const { expectedRevision } = options;
    const publishRetryPolicy = createPublishRetryPolicy(expectedRevision);

    try {
      return await publishRetryPolicy.execute(() => this.$publish(aggregate, _events, options));
    } catch (e: unknown) {
      if (_.isError(e) && isConditionCheckFailed(e)) {
        if (expectedRevision !== undefined) {
          throw new ExpectedRevisionConflictError(expectedRevision);
        }

        throw new RevisionConflictError();
      }

      throw e;
    }
  };

  private async $publish(
    aggregate: AggregateId,
    events: DomainEvent[],
    options: EventStore.PublishOptions = {}
  ): Promise<Revision> {
    const { encrypt, expectedRevision } = options;

    const recorded: RecordedEvent[] = await Promise.all(
      events
        .map((event) => {
          // Validate that the event has the proper DomainEvent structure
          const domainEventSchema = z.object({
            type: z.string().min(1),
            data: Payload.schema,
          });
          return domainEventSchema.parse(event);
        })
        .map((event) =>
          this.$encoder(aggregate, event, _.pick(options, "correlationId", "causationId"), encrypt ?? false)
        )
    );

    const changeSet = await ChangeSet.create(aggregate, recorded);
    return this.$write(changeSet, expectedRevision);
  }

  private async $write(changeSet: ChangeSet, expectedRevision?: string): Promise<Revision> {
    const TableName = this.$table;

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

    await this.$client.send(write);

    return changeSet.revision;
  }
}
