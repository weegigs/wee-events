import * as T from "@effect-ts/core/Effect";
import * as L from "@effect-ts/core/Effect/Layer";
import { tag } from "@effect-ts/core/Has";

import { SFNClient } from "@aws-sdk/client-sfn";

export const StepFunctions = tag<SFNClient>();

export const provider = T.provideService(StepFunctions)(new SFNClient({}));
export const layer = L.fromEffect(StepFunctions)(T.succeedWith(() => new SFNClient({})));
