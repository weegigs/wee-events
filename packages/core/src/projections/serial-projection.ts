import * as R from "ramda";

import { BehaviorSubject, Observable, Subscription } from "rxjs";

import { EventStore, EventStreamOptions } from "../event-store";
import { Projection, ProjectionFunction, ProjectionListenerFunction, ProjectionPosition } from "./types";
import { timeout } from "../utilities";
import { PublishedEvent } from "../index";

export class SerialProjection implements Projection {
  private readonly latest = new BehaviorSubject<PublishedEvent | undefined>(undefined);

  constructor(private projection: ProjectionFunction, private options: EventStreamOptions = {}) {}

  attach = (store: EventStore): Subscription => {
    const stream = store.stream(this.options);

    return Observable.zip(stream, this.latest).subscribe(async ([event, last]) => {
      const next = event.id;
      const current: ProjectionPosition | undefined = R.propOr(undefined, "id", last);
      if (undefined === current || next > current) {
        try {
          await this.projection(event);
          this.latest.next(event);
        } catch (e) {
          this.latest.next(last);
        }
      }
    });
  };

  listen = (listener: ProjectionListenerFunction) => {
    return this.latest
      .distinctUntilChanged(R.equals)
      .filter((e): e is PublishedEvent => e !== undefined)
      .subscribe(async event => listener(event as PublishedEvent));
  };

  waitFor = async (position: ProjectionPosition, duration: number = 5000): Promise<ProjectionPosition> => {
    return timeout(
      duration,
      new Promise<ProjectionPosition>((resolve, reject) => {
        this.latest
          .distinctUntilChanged(R.equals)
          .map(e => (e === undefined ? e : e.id))
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
