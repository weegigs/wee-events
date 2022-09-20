import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { pipe } from "@effect-ts/core";
import * as T from "@effect-ts/core/Effect";
import * as L from "@effect-ts/core/Effect/Layer";
import { tag } from "@effect-ts/core/Has";

import * as s from "@weegigs/dynamo-event-store";
import * as dyn from "./aws/dynamodb";

import * as env from "./environment";
import * as es from "./event-store";

import * as wee from "@weegigs/events-core";

export interface DynamoEventStoreConfig {
  readonly client: DynamoDBClient;
  readonly table: string;
}
export const DynamoEventStoreConfig = tag<DynamoEventStoreConfig>();

const config = pipe(
  T.do,
  T.bindAllPar(() => ({
    client: T.service(dyn.Dynamo),
    table: env.text("EVENT_STORE_TABLE"),
  })),
  T.map(({ client, table }): DynamoEventStoreConfig => ({ client, table }))
);

const _configL = L.fromEffect(DynamoEventStoreConfig)(config);

export const dynamoStore = T.gen(function* (_) {
  const config = yield* _(DynamoEventStoreConfig);
  const es: wee.EventStore = new s.DynamoEventStore(config.table, { client: () => config.client });

  return es;
});

export const live = _configL[">>>"](L.fromEffect(es.EventStore)(dynamoStore));
