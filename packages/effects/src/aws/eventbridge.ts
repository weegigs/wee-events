import * as T from "@effect-ts/core/Effect";
import * as L from "@effect-ts/core/Effect/Layer";
import { tag } from "@effect-ts/core/Has";

import { EventBridgeClient } from "@aws-sdk/client-eventbridge";

export type EventBridge = EventBridgeClient;
export const EventBridge = tag<EventBridge>();

export const layer = L.fromEffect(EventBridge)(T.succeedWith(() => new EventBridgeClient({})));
