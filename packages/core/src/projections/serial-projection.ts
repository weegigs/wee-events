import * as R from "ramda";

import { BehaviorSubject, Observable, Subscription } from "rxjs";

import { EventStore, EventStreamOptions } from "../event-store";
import { Projection, ProjectionFunction, ProjectionPosition } from "./types";
import { timeout } from "../utilities";

export class SerialProjection implements Projection {
  private readonly versions = new BehaviorSubject<ProjectionPosition>(undefined);

  constructor(private projection: ProjectionFunction, private options: EventStreamOptions = {}) {}

  attach = (store: EventStore): Subscription => {
    const stream = store.stream(this.options);

    return Observable.zip(stream, this.versions).subscribe(async ([event, last]) => {
      const next = event.id;
      const current: ProjectionPosition | undefined = R.propOr(undefined, "version", last);
      if (undefined === current || next > current) {
        try {
          await this.projection(event);
          this.versions.next(next);
        } catch (e) {
          this.versions.next(last);
        }
      }
    });
  };

  waitFor = async (position: ProjectionPosition, duration: number = 5000): Promise<ProjectionPosition> => {
    return timeout(
      duration,
      new Promise<ProjectionPosition>((resolve, reject) => {
        this.versions
          .distinctUntilChanged()
          .filter(current => newer(current, position))
          .take(1)
          .subscribe(p => resolve(p));
      })
    );
  };
}

export function createSerialProjection(
  projection: ProjectionFunction,
  options?: EventStreamOptions
): Projection {
  return new SerialProjection(projection, options);
}

function newer(current?: ProjectionPosition, update?: ProjectionPosition): boolean {
  if (undefined === update) return false;
  if (undefined === current) return true;
  else return update > current;
}
