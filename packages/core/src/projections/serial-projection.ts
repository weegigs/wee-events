import * as R from "ramda";

import { BehaviorSubject, Observable, Subscription } from "rxjs";

import { EventStore, EventListenerOptions } from "../event-store";

import { Projection, ProjectionConsistency, ProjectionFunction, ProjectionPosition } from "./types";

export interface SerialProjectionOptions extends EventListenerOptions {
  consistency?: ProjectionConsistency;
}

export class SerialProjection implements Projection {
  readonly consistency: ProjectionConsistency;
  readonly position: Observable<ProjectionPosition>;

  private readonly versions = new BehaviorSubject<ProjectionPosition>(undefined);

  constructor(private projection: ProjectionFunction, private options: SerialProjectionOptions = {}) {
    this.consistency = options.consistency || "eventual";
    this.position = this.versions.asObservable().distinctUntilChanged();
  }

  attach = (store: EventStore): Subscription => {
    const stream = store.stream(this.options);

    return Observable.zip(stream, this.versions).subscribe(async ([event, last]) => {
      const next = event.id;
      const current: string | undefined = R.propOr(undefined, "version", last);
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
}
