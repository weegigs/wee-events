import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";

import * as s from "@weegigs/dynamo-event-store";
import * as dyn from "./aws/dynamodb";

import * as env from "./environment";
import * as es from "./event-store";

import * as wee from "@weegigs/events-core";

export interface DynamoEventStoreConfig {
  readonly client: DynamoDBClient;
  readonly table: string;
}
export const DynamoEventStoreConfig = Context.GenericTag<DynamoEventStoreConfig>("DynamoEventStoreConfig");

const config = Effect.gen(function* () {
  const client = yield* dyn.DynamoDB;
  const table = yield* env.text("EVENT_STORE_TABLE");
  return { client, table };
});

const _configL = Layer.effect(DynamoEventStoreConfig, config);

export const dynamoStore = Effect.gen(function* () {
  const config = yield* DynamoEventStoreConfig;
  const es: wee.EventStore = new s.DynamoEventStore(config.table, {
    client: () => DynamoDBDocumentClient.from(config.client),
  });

  return es;
});

export const live = Layer.effect(es.EventStore, dynamoStore).pipe(Layer.provide(_configL));
