import * as T from "@effect-ts/core/Effect";
import * as L from "@effect-ts/core/Effect/Layer";
import { tag } from "@effect-ts/core/Has";

import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";

export const CloudwatchSymbol = Symbol();
export type Cloudwatch = CloudWatchClient;
export const Cloudwatch = tag<Cloudwatch>(CloudwatchSymbol);

export const layer = L.fromEffect(Cloudwatch)(T.succeedWith(() => new CloudWatchClient({})));
