import { CollectionReference, DocumentSnapshot } from "@google-cloud/firestore";
import { Observable, Subscriber } from "rxjs";

import {
  Event,
  PublishedEvent,
  AggregateId,
  EventStore,
  EventListenerOptions,
  SnapshotOptions,
  stampEvent,
} from "@weegigs/events-core";

export class FirestoreEventStore implements EventStore {
  constructor(private collection: CollectionReference) {}

  private get events() {
    return this.collection.orderBy("id");
  }

  async publish(events: Event | Event[]): Promise<PublishedEvent[]> {
    const published = stampEvent(events);
    const collection = this.collection;

    const batch = this.collection.firestore.batch();
    const normalized = await Promise.all(
      published.map(async event => {
        if (event.key) {
          const doc = await collection.doc(event.key).get();
          if (doc.exists) {
            return asEvent(doc);
          }
        }

        batch.create(this.document(event), event);
        return event;
      })
    );

    await batch.commit();
    return normalized;
  }

  stream(options: EventListenerOptions = {}): Observable<PublishedEvent> {
    return Observable.create((subscriber: Subscriber<PublishedEvent>) => {
      let query = this.events;

      const { after } = options;

      if (after) {
        query = query.startAfter(after);
      }

      const subscription = query.onSnapshot(snapshot => {
        snapshot.docChanges
          .filter(change => change.type === "added")
          .map(change => asEvent(change.doc))
          .forEach(event => subscriber.next(event));
      });

      return subscription;
    });
  }

  async snapshot(aggregateId: AggregateId, options?: SnapshotOptions | undefined): Promise<PublishedEvent[]> {
    const query = this.collection
      .orderBy("id")
      .where("aggregateId.id", "==", aggregateId.id)
      .where("aggregateId.type", "==", aggregateId.type);

    const snapshot = await query.get();

    return events(snapshot.docs);
  }

  private document(event: PublishedEvent) {
    return this.collection.doc(event.key || event.id);
  }
}

function events(docs: DocumentSnapshot[]): PublishedEvent[] {
  return docs.map(asEvent);
}

function asEvent(doc: DocumentSnapshot): PublishedEvent {
  return doc.data() as PublishedEvent;
}
