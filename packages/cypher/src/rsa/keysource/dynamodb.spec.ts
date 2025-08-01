import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { CreateTableCommand, DescribeTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GenericContainer, type StartedTestContainer } from "testcontainers";

import { RSACypher } from "../cypher";
import { DynamoKeySource } from "./dynamodb";

const TableName = "test-table";

describe("dynamo key source", () => {
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
        secretAccessKey: "test",
      },
      region: "us-east-1",
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
  }, 100000); // Set a generous timeout for this hook

  afterAll(async () => {
    await dbc.stop();
  });

  it("should provide the key for a aggregate", async () => {
    const source = DynamoKeySource.create({ table: TableName, client: () => client });

    const keypair = await source({ type: "test-type", key: "test-id" });

    expect(keypair).toBeDefined();
    expect(keypair.privateKey).toBeDefined();
    expect(keypair.publicKey).toBeDefined();
  });

  it("provided keys should be valid for encryption", async () => {
    const id = { key: "test-id", type: "test-type" };
    const payload = { test: "test" };

    const keys = DynamoKeySource.create({ table: TableName, client: () => client });
    const cypher = RSACypher.create({ keys });

    const data = await cypher.encrypt(id, payload);
    const recovered = await cypher.decrypt(id, data);

    expect(recovered).toEqual(payload);
  });
});
