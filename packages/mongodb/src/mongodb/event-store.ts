import { Observable, Subject, Observer } from "rxjs";
import { Collection, IndexOptions, MongoError } from "mongodb";

import {
  Event,
  PublishedEvent,
  AggregateId,
  EventStore,
  EventStreamOptions,
  EventSnapshotOptions,
  stampEvent as toPublished,
} from "@weegigs/events-core";

async function createIndexes(collection: Collection) {
  const ids = createIndex(
    "event-ids",
    { id: 1 },
    {
      unique: true,
    },
    collection
  );

  const aggregates = createIndex(
    "event-aggregates",
    { "aggregateId.type": 1, "aggregateId.id": 1 },
    {},
    collection
  );

  return Promise.all([ids, aggregates]);
}

async function createIndex(
  name: string,
  fields: Record<string, 1 | -1>,
  options: IndexOptions,
  collection: Collection
) {
  if (!await collection.indexExists(name)) {
    await collection.createIndex(fields, { ...options, name });
  }
}

export class MongoEventStore implements EventStore {
  private events = new Subject<PublishedEvent>();

  private constructor(private readonly collection: Collection<PublishedEvent>) {}

  static async create(collection: Collection<PublishedEvent>): Promise<MongoEventStore> {
    await createIndexes(collection);
    return new MongoEventStore(collection);
  }

  async publish(events: Event | Event[]): Promise<PublishedEvent[]> {
    const published = toPublished(events);

    await this.collection.insertMany(published);
    published.forEach(e => this.events.next(e));

    return published;
  }

  stream(options: EventStreamOptions = {}): Observable<PublishedEvent> {
    const collection = this.collection;
    let latest = "";

    const existing: Observable<PublishedEvent> = Observable.create((observer: Observer<PublishedEvent>) => {
      const { after } = options;

      const query = after === undefined ? undefined : { id: { $gt: after } };
      const cursor = collection.find(query).sort({ id: 1 });

      cursor.forEach(
        event => {
          latest = event.id;
          observer.next(event);
        },
        (error: MongoError | null) => {
          if (error === null) {
            observer.complete();
          } else {
            observer.error(error);
          }
        }
      );

      return () => cursor.close();
    });

    const updates = Observable.defer(() => this.events.filter(e => e.id > latest));
    return existing.concat(updates);
  }

  async snapshot(aggregateId: AggregateId, options: EventSnapshotOptions = {}): Promise<PublishedEvent[]> {
    const { after } = options;

    const query = after
      ? {
          aggregateId,
          id: { $gt: after },
        }
      : { aggregateId };

    return this.collection
      .find(query)
      .sort({ id: 1 })
      .toArray();
  }
}
