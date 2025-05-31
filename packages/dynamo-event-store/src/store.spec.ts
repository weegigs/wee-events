import _ from "lodash";

import { range } from "@weegigs/events-common";
import { Cypher, Tokenizer } from "@weegigs/events-cypher";

import { CreateTableCommand, DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DomainEvent, Payload, Revision, AggregateId, Errors } from "@weegigs/events-core";
import { GenericContainer, StartedTestContainer } from "testcontainers";

import { DynamoEventStore } from "./store";

// it takes time to spin the containers up
jest.setTimeout(100000);

const sampleEvent: DomainEvent = {
  type: "test:test-event",
  data: {
    string: "a string",
    number: 123,
    boolean: true,
    nested: {
      string: "a nested string",
      number: 72600,
    },
    array: ["one"],
  },
};

let id: string;
function testStream(suffix = ""): AggregateId {
  return { type: "test", key: `${id}${suffix}` };
}

beforeEach(() => {
  id = Date.now().toString() + Math.random().toString(36).substring(2);
});

const tokenizer: Tokenizer = Tokenizer.create(async (path, value) => {
  return `${path}:${value}`;
});

const cypher: Cypher = {
  async decrypt(_streamId: AggregateId, buffer: Buffer): Promise<Payload> {
    const decoded = buffer.toString("utf-8");
    return JSON.parse(decoded.split("").reverse().join(""));
  },
  async encrypt(_streamId: AggregateId, payload: Payload): Promise<Buffer> {
    const encrypted = JSON.stringify(payload).split("").reverse().join("");
    return Buffer.from(encrypted, "utf-8");
  },
};

const TableName = "test-events";

describe("dynamo store", () => {
  let dbc: StartedTestContainer;
  let client: DynamoDBDocumentClient;

  beforeAll(async () => {
    dbc = await new GenericContainer("amazon/dynamodb-local")
      .withExposedPorts(8000)
      .withCommand(["-jar", "DynamoDBLocal.jar", "-sharedDb", "-inMemory"])
      .start();
    const dynamo = new DynamoDBClient({
      endpoint: `http://${dbc.getHost()}:${dbc.getMappedPort(8000)}`,
      credentials: { 
        accessKeyId: "test", 
        secretAccessKey: "test" 
      },
      region: "us-east-1"
    });

    const create = new CreateTableCommand({
      TableName,
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" }, //Partition key
        { AttributeName: "sk", KeyType: "RANGE" }, //Sort key
      ],
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 10,
        WriteCapacityUnits: 10,
      },
    });

    await dynamo.send(create);

    let ready = false;
    do {
      const describe = new DescribeTableCommand({ TableName });
      const { Table } = await dynamo.send(describe);

      ready = Table?.TableStatus === "ACTIVE";
    } while (!ready);

    client = DynamoDBDocumentClient.from(dynamo, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });
  });

  afterAll(async () => {
    await dbc.stop();
  });

  const createStore = (options: Partial<Omit<DynamoEventStore.Options, "client">> = {}) =>
    new DynamoEventStore(TableName, { ...options, client: () => client });

  describe("event publishing", () => {
    it("publishes basic events", async () => {
      const store = createStore();

      const revision = await store.publish(testStream(), sampleEvent);

      expect(revision).toBeDefined();
      expect(revision).toHaveLength(26);
    });

    it("rejects events with an incorrect expected revision", async () => {
      const store = createStore();

      try {
        await store.publish(testStream(), sampleEvent, {
          expectedRevision: "bob",
        });
        throw new Error("expected publish to fail");
      } catch (e: unknown) {
        expect((e as Error).message).toEqual("revision did not match the expected revision of bob");
        expect((e as any).name).toEqual("expected-revision-conflict");
        expect(Errors.isExpectedRevisionConflict(e as any)).toBeTruthy();
      }
    });

    it("rejects events with when expecting an empty aggregate", async () => {
      const store = createStore();

      await store.publish(testStream(), sampleEvent);
      try {
        await store.publish(testStream(), sampleEvent, {
          expectedRevision: Revision.Initial,
        });
        throw new Error("expected publish to fail");
      } catch (e: unknown) {
        expect((e as Error).message).toEqual("revision did not match the expected revision of 00000000000000000000000000");
        expect((e as any).name).toEqual("expected-revision-conflict");
        expect(Errors.isExpectedRevisionConflict(e as any)).toBeTruthy();
      }
    });

    it("publishes events with an correct expected revision", async () => {
      const store = createStore();

      const first = await store.publish(testStream(), sampleEvent, {});
      const second = await store.publish(testStream(), sampleEvent, {
        expectedRevision: first,
      });

      expect(second).toBeDefined();
      expect(second).toHaveLength(26);
    });

    it("rejects events with invalid data", async () => {
      const store = createStore();
      try {
        await store.publish(testStream(), { type: "invalid-data", data: { value: null } } as any);
        throw new Error("expected publish to fail");
      } catch (e: unknown) {
        expect(e).toMatchSnapshot();
      }
    });

    it("rejects events with invalid type", async () => {
      const store = createStore();
      try {
        await store.publish(testStream(), { type: "", data: {} });
        throw new Error("expected publish to fail");
      } catch (e: unknown) {
        expect(e).toMatchSnapshot();
      }
    });
  });

  describe("aggregate loading", () => {
    it("loads streams with no events", async () => {
      const store = createStore();
      const events = await store.load(testStream("-new"));

      expect(events).toHaveLength(0);
    });

    it("loads streams with one event", async () => {
      const store = createStore();
      await store.publish(testStream("-existing"), sampleEvent);

      const events = await store.load(testStream("-existing"));

      expect(events).toBeDefined();
      expect(events).toHaveLength(1);
    });

    it("loads streams with multiple events", async () => {
      const store = createStore();
      for (let i = 0; i < 5; i++) {
        await store.publish(testStream("-multiple"), sampleEvent);
      }

      const events = await store.load(testStream("-multiple"));

      expect(events).toHaveLength(5);
      expect(_.sortBy(events, (e) => e.timestamp)).toEqual(events);
    });

    it("loads streams with events published in a batch", async () => {
      const store = createStore();

      for (let i = 0; i < 5; i++) {
        await store.publish(
          testStream("-batch"),
          Array(...range(5)).map((_) => sampleEvent)
        );
      }

      const events = await store.load(testStream("-batch"));

      expect(events).toHaveLength(25);
      expect(_.sortBy(events, (e) => e.timestamp)).toEqual(events);
    });
  });

  describe("correlation", () => {
    it("should connect correlation ids to events", async () => {
      const store = createStore();
      await store.publish(testStream("-correlate"), sampleEvent, { correlationId: "bob" });

      const events = await store.load(testStream("-correlate"));

      expect(events).toBeDefined();
      expect(events).toHaveLength(1);
      expect(events[0].metadata.correlationId).toEqual("bob");
    });

    it("should connect causation ids to events", async () => {
      const store = createStore();
      await store.publish(testStream("-causation"), sampleEvent, { causationId: "123" });

      const events = await store.load(testStream("-causation"));

      expect(events).toBeDefined();
      expect(events).toHaveLength(1);
      expect(events[0].metadata.causationId).toEqual("123");
    });

    it("should connect both correlation & causation ids to events", async () => {
      const store = createStore();
      await store.publish(testStream("-correlation-causation"), sampleEvent, {
        correlationId: "bob",
        causationId: "123",
      });

      const events = await store.load(testStream("-correlation-causation"));

      expect(events).toBeDefined();
      expect(events).toHaveLength(1);
      expect(events[0].metadata.correlationId).toEqual("bob");
      expect(events[0].metadata.causationId).toEqual("123");
    });
  });

  describe("encryption", () => {
    it("should tokenize the content of encrypted events", async () => {
      const store = createStore({ tokenizer, cypher });
      await store.publish(testStream("-tokenize"), sampleEvent, { encrypt: true });

      const events = await store.load(testStream("-tokenize"));
      expect(events).toHaveLength(1);
      expect(events[0].data).not.toEqual(sampleEvent.data);
      expect(events[0].data).toMatchSnapshot();
    });

    it("should allow you to decrypt events", async () => {
      const store = createStore({ tokenizer, cypher });
      await store.publish(testStream("-decrypt"), sampleEvent, { encrypt: true });

      const events = await store.load(testStream("-decrypt"), { decrypt: true });
      expect(events).toHaveLength(1);
      expect(events[0].data).toEqual(sampleEvent.data);
    });

    it("should process streams with both encrypted and unencrypted events", async () => {
      const store = createStore({ tokenizer, cypher });
      await store.publish(testStream("-maybe-decrypt"), sampleEvent);
      await store.publish(testStream("-maybe-decrypt"), sampleEvent, { encrypt: true });

      const events = await store.load(testStream("-maybe-decrypt"), { decrypt: true });
      expect(events).toHaveLength(2);
      expect(events[0].data).toEqual(sampleEvent.data);
      expect(events[1].data).toEqual(sampleEvent.data);
    });
  });
});
