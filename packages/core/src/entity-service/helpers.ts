import _ from "lodash";
import { RecordedEvent, Revision } from "../types";

export const revisionFrom = (events: RecordedEvent[]): Revision => {
  return _.last(events)?.revision ?? Revision.Initial;
};
