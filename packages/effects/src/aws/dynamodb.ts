import * as T from "@effect-ts/core/Effect";
import * as L from "@effect-ts/core/Effect/Layer";
import { tag, Has } from "@effect-ts/core/Has";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export const DynamoSymbol = Symbol();
export const Dynamo = tag<DynamoDBClient>(DynamoSymbol);
export type HasDynamo = Has<DynamoDBClient>;

export const layer = L.fromEffect(Dynamo)(T.succeedWith(() => new DynamoDBClient({})));
export const service = T.service(Dynamo);
