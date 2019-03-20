import { Observable, Subject, Observer, defer, concat } from "rxjs";
import { filter } from "rxjs/operators";
import { Collection, MongoError, ReadPreference } from "mongodb";

import {
  SourceEvent,
  PublishedEvent,
  AggregateId,
  EventStore,
  EventStreamOptions,
  EventSnapshotOptions,
  stampEvent as toPublished,
  eventId,
} from "@weegigs/events-core";

import { createIndex } from "./utilities";

async function createIndexes(collection: Collection) {
  const ids = createIndex(
    "event-ids",
    { "__publicationMetadata.id": 1 },
    {
      unique: true,
    },
    collection
  );

  const aggregates = createIndex("event-aggregates", { "aggregateId.type": 1, "aggregateId.id": 1 }, {}, collection);

  return Promise.all([ids, aggregates]);
}

export class MongoEventStore implements EventStore {
  private events = new Subject<PublishedEvent<any>>();

  private constructor(private readonly collection: Collection<PublishedEvent<any>>) {}

  static async create(collection: Collection<PublishedEvent<any>>): Promise<MongoEventStore> {
    await createIndexes(collection);
    return new MongoEventStore(collection);
  }

  async publish(events: SourceEvent<any> | SourceEvent<any>[]): Promise<PublishedEvent<any>[]> {
    const published = toPublished(events).map(e => ({ _id: eventId(e), ...e }));

    await this.collection.insertMany(published, { w: "majority" });
    published.forEach(e => this.events.next(e));

    return published;
  }

  stream<E extends SourceEvent = any>(options: EventStreamOptions = {}): Observable<PublishedEvent<E>> {
    const collection = this.collection;
    let latest = "";

    const existing: Observable<PublishedEvent<E>> = new Observable((observer: Observer<PublishedEvent<E>>) => {
      const { after } = options;

      const query = after === undefined ? undefined : { "__publicationMetadata.id": { $gt: after } };
      const cursor = collection.find<any>(query).sort({ "__publicationMetadata.id": 1 });

      cursor.forEach(
        event => {
          latest = eventId(event);
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

    // subscribe into buffer

    const updates = defer(() => this.events.pipe(filter(e => eventId(e) > latest)));
    return concat(existing, updates);
  }

  async snapshot(aggregateId: AggregateId, options: EventSnapshotOptions = {}): Promise<PublishedEvent<any>[]> {
    const { after } = options;

    const aggregate = {
      "aggregateId.type": aggregateId.type,
      "aggregateId.id": aggregateId.id,
    };

    const query = after
      ? {
          ...aggregate,
          "__publicationMetadata.id": { $gt: after },
        }
      : aggregate;

    return this.collection
      .find(query)
      .setReadPreference(ReadPreference.PRIMARY)
      .sort({ "__publicationMetadata.id": 1 })
      .toArray();
  }
}
