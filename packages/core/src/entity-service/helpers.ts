import _ from "lodash";
import { RecordedEvent, Revision } from "../types";

export const revisionFor = (events: RecordedEvent[]) => {
  return _.last(events)?.revision ?? Revision.Initial;
};
