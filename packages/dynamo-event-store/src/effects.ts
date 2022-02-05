import * as T from "@effect-ts/core/Effect";
import * as L from "@effect-ts/core/Effect/Layer";
import { tag, Has } from "@effect-ts/core/Has";
import { pipe } from "@effect-ts/core";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import * as env from "@weegigs/effects/lib/environment";
import * as dyn from "@weegigs/effects/lib/aws/dynamodb";

import * as s from "./store";
import * as e from "@weegigs/wee-events";

export const EventStore = tag<e.EventStore>();
export type HasEventStore = Has<e.EventStore>;

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
  return new s.DynamoEventStore(config.table, { client: () => config.client });
});

export const live = _configL[">>>"](L.fromEffect(EventStore)(dynamoStore));
