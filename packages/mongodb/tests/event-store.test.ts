import * as R from "ramda";

import { MongoClient, Db, Collection } from "mongodb";
import { EventStore, Event, PublishedEvent, EventStreamOptions, subscribe } from "@weegigs/events-core";
import { Subscription } from "rxjs";

import { MongoEventStore } from "../src";
import { exec } from "child_process";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

const testOne = testId("1");

describe("mongo event store", () => {
  let client: MongoClient;
  let db: Db;
  let collection: Collection;

  beforeAll(async done => {
    client = await MongoClient.connect("mongodb://localhost:27017/", { poolSize: 50 });
    db = client.db("test");

    done();
  });

  beforeEach(async done => {
    collection = await db.createCollection("events");

    done();
  });

  afterEach(async done => {
    await collection.drop();
    done();
  });

  afterAll(async done => {
    await client.close();
    done();
  });

  describe("creating the event store", () => {
    it("can be created", async () => {
      const store = await MongoEventStore.create(collection);
      expect(store).toBeDefined();

      const indexes = await collection.indexes();
      expect(indexes).toHaveLength(3);
    });

    it("only creates indexes if required", async () => {
      await MongoEventStore.create(collection);
      await MongoEventStore.create(collection);

      const indexes = await collection.indexes();
      expect(indexes).toHaveLength(3);
    });
  });

  describe("adding events", () => {
    it("can add an event", async () => {
      const store = await MongoEventStore.create(collection);

      const id = { type: "test", id: "1" };

      const event: Event = { type: "test/1", aggregateId: id };
      const published = await store.publish(event);
      expect(published[0].id).toBeDefined();

      const snapshot = await store.snapshot(id);
      expect(snapshot).toHaveLength(1);
      expect(snapshot[0].aggregateId).toEqual(id);
    });

    it("can add a batch of events", async () => {
      const store = await MongoEventStore.create(collection);

      const id = { type: "test", id: "1" };

      const events: Event[] = R.range(0, 10).map(n => ({ type: `test/${n}`, aggregateId: id }));
      const published = await store.publish(events);
      expect(published).toHaveLength(10);

      const snapshot = await store.snapshot(id);
      expect(snapshot).toHaveLength(10);
      expect(snapshot[0].aggregateId).toEqual(id);

      const sorted = snapshot.sort((a, b) => a.id.localeCompare(b.id));

      expect(snapshot).toEqual(sorted);
    });

    it("can limit events to events occurring after", async () => {
      const store = await MongoEventStore.create(collection);

      const id = { type: "test", id: "1" };

      const events: Event[] = R.range(0, 10).map(n => ({ type: `test/${n}`, aggregateId: id }));
      const published = await store.publish(events);
      expect(published).toHaveLength(10);

      const snapshot = await store.snapshot(id, { after: published[4].id });
      expect(snapshot).toHaveLength(5);
      expect(snapshot[0].id).toEqual(published[5].id);

      const sorted = snapshot.sort((a, b) => a.id.localeCompare(b.id));

      expect(snapshot).toEqual(sorted);
    });
  });

  describe("streaming events", () => {
    let subscription: Subscription;
    afterEach(done => {
      if (subscription) {
        subscription.unsubscribe();
        subscription = null;
      }
      done();
    });

    it("can be subscribed to", async () => {
      const store = await MongoEventStore.create(collection);

      let events: any[] = [];
      subscription = subscribe(store, async e => {
        events.push(e);
      });

      expect(subscription).toBeDefined();
    });

    it("broadcasts newly published events", async () => {
      const store = await MongoEventStore.create(collection);

      const next: Promise<PublishedEvent> = new Promise((resolve, reject) => {
        subscription = take(store, 1)(e => resolve(e[0]));
      });

      const [published] = await store.publish({ type: "test", aggregateId: testOne });
      const event = await next;

      expect(event).toBeDefined();
      expect(event).toEqual(published);
    });

    it("broadcasts existing events", async () => {
      const store = await MongoEventStore.create(collection);

      const [published] = await store.publish({ type: "test", aggregateId: testOne });

      const next: Promise<PublishedEvent> = new Promise((resolve, reject) => {
        subscription = take(store, 1)(e => resolve(e[0]));
      });
      const event = await next;

      expect(event).toBeDefined();
      expect(event).toEqual(published);
    });

    it("broadcasts existing and new events", async () => {
      const store = await MongoEventStore.create(collection);

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
      const store = await MongoEventStore.create(collection);

      const [before] = await store.publish({ type: "test", aggregateId: testOne });
      const [after] = await store.publish({ type: "test", aggregateId: testId("2") });

      const second: Promise<PublishedEvent> = new Promise((resolve, reject) => {
        subscription = subscribe(store, async e => resolve(e), { after: before.id });
      });

      const event = await second;

      expect(event).toBeDefined();
      expect(event).toEqual(after);
    });
  });
});

function take(store: EventStore, count: number) {
  return (subscription: (value: any) => void, options: EventStreamOptions = {}) => {
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
