import * as path from "path";
import * as R from "ramda";

import { SourceEvent, PublishedEvent, subscribe, eventId } from "@weegigs/events-core";
import { Firestore, CollectionReference } from "@google-cloud/firestore";
import { Subscription } from "rxjs";
import { config } from "dotenv";

import { FirestoreEventStore, FirestoreStreamOptions } from "../src/";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

config();

const testOne = testId("1");

describe("creating a firestore store", () => {
  it("can be created", async () => {
    const db = new Firestore();
    const events = db.collection("test").doc("events");
    const store = await FirestoreEventStore.create(events);

    expect(store).toBeDefined();
  });
});

describe("adding events", () => {
  const db = new Firestore();
  const events = db.doc("test/events");
  const all = events.collection("all");
  const store = new FirestoreEventStore(events);

  beforeAll(async () => {
    const docs = await clear(all);
  });

  afterEach(async () => {
    const docs = await clear(all);
  });

  it("can add an event", async () => {
    const id = { type: "test", id: "1" };

    const event: SourceEvent = { type: "test/1", aggregateId: id };
    const published = await store.publish(event);
    expect(eventId(published[0])).toBeDefined();

    const snapshot = await store.snapshot(id);
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].aggregateId).toEqual(id);
  });

  it("can add a batch of events", async () => {
    const id = { type: "test", id: "1" };

    const events: SourceEvent[] = R.range(0, 10).map(n => ({ type: `test/${n}`, aggregateId: id }));
    const published = await store.publish(events);
    expect(published).toHaveLength(10);

    const snapshot = await store.snapshot(id);
    expect(snapshot).toHaveLength(10);
    expect(snapshot[0].aggregateId).toEqual(id);

    const sorted = snapshot.sort((a, b) => eventId(a).localeCompare(eventId(b)));

    expect(snapshot).toEqual(sorted);
  });
});

describe("listening for events", () => {
  const db = new Firestore();
  const events = db.collection("test").doc("events");
  const all = events.collection("all");
  const store = new FirestoreEventStore(events);
  store.stream();

  afterEach(async done => {
    const docs = await clear(all);
    done();
  });

  it("can add an event", async () => {
    const id = { type: "test", id: "1" };

    const event: SourceEvent = { type: "test/1", aggregateId: id };
    const published = await store.publish(event);
    expect(eventId(published[0])).toBeDefined();

    const snapshot = await store.snapshot(id);
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].aggregateId).toEqual(id);
  });

  it("can add a batch of events", async () => {
    const id = { type: "test", id: "1" };

    const events: SourceEvent[] = R.range(0, 10).map(n => ({ type: `test/${n}`, aggregateId: id }));
    const published = await store.publish(events);
    expect(published).toHaveLength(10);

    const snapshot = await store.snapshot(id);
    expect(snapshot).toHaveLength(10);
    expect(snapshot[0].aggregateId).toEqual(id);

    const sorted = snapshot.sort((a, b) => eventId(a).localeCompare(eventId(b)));

    expect(snapshot).toEqual(sorted);
  });
});

describe("streaming events", () => {
  const db = new Firestore();
  const events = db.collection("test").doc("events");
  const all = events.collection("all");
  const store = new FirestoreEventStore(events);

  const take1 = take(store, 1);
  const take2 = take(store, 2);
  const take3 = take(store, 3);

  let subscription: Subscription;

  afterEach(async () => {
    if (subscription) {
      subscription.unsubscribe();
      subscription = null;
    }
    const docs = await clear(all);
  });

  it("can be subscribed to", async () => {
    let events: any[] = [];
    const subscription = subscribe(store, async e => {
      events.push(e);
    });

    expect(subscription).toBeDefined();
  });

  it("broadcasts newly published events", async () => {
    const next: Promise<PublishedEvent> = new Promise((resolve, reject) => {
      subscription = take1(e => resolve(e[0]));
    });

    const [published] = await store.publish({ type: "test", aggregateId: testOne });
    const event = await next;

    expect(event).toBeDefined();
    expect(event).toEqual(published);
  });

  it("broadcasts existing events", async () => {
    const [published] = await store.publish({ type: "test", aggregateId: testOne });

    const next: Promise<PublishedEvent> = new Promise((resolve, reject) => {
      subscription = take1(e => resolve(e[0]));
    });
    const event = await next;

    expect(event).toBeDefined();
    expect(event).toEqual(published);
  });

  it("broadcasts existing and new events", async () => {
    const [first] = await store.publish({ type: "test", aggregateId: testOne });
    const publications: Promise<PublishedEvent[]> = new Promise((resolve, reject) => {
      subscription = store
        .stream()
        .take(2)
        .toArray()
        .subscribe(e => resolve(e));
    });
    const [second] = await store.publish({ type: "test", aggregateId: testId("2") });

    const events = await publications;

    expect(events).toBeDefined();
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual(first);
    expect(events[1]).toEqual(second);
  });

  it("broadcasts after specified event", async () => {
    const [before] = await store.publish({ type: "test", aggregateId: testOne });
    const [after] = await store.publish({ type: "test", aggregateId: testId("2") });

    const second: Promise<PublishedEvent> = new Promise((resolve, reject) => {
      subscription = subscribe(store, async e => resolve(e), { after: eventId(before) });
    });

    const event = await second;

    expect(event).toBeDefined();
    expect(event).toEqual(after);
  });
});

async function clear(collection: CollectionReference, count: number = 0): Promise<number> {
  const docs = await collection
    .orderBy("__name__")
    .limit(37)
    .get();

  if (docs.size === 0) {
    return count;
  }

  const batch = collection.firestore.batch();
  docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  const writeResults = await batch.commit();
  return clear(collection, count + writeResults.length);
}

function take(store: FirestoreEventStore, count: number) {
  return (subscription: (value: any) => void, options: FirestoreStreamOptions = {}) => {
    return store
      .stream(options)
      .take(count)
      .toArray()
      .subscribe(subscription);
  };
}

function testId(key: string = "1", type: string = "test") {
  return { id: key, type };
}
