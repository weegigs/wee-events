import util from "util";
import crypto from "crypto";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { AggregateId } from "@weegigs/wee-events";

import { KeySource, KeyPair } from "../keysource";

const generateKeyPair = util.promisify(crypto.generateKeyPair);

const defaults = {
  client: () => new DynamoDBClient({}),
};

export namespace DynamoKeySource {
  const keyFor = (id: AggregateId) => `key#${id.type}#${id.type}`;

  export type Options = {
    table: string;
    client?: () => DynamoDBClient;
  };

  /***
   * Manages keys stored in dynamodb
   *
   * **IMPORTANT** keys should be stored in a distinct table from the events otherwise a breach in access to
   * the table will result in full access to the data
   *
   */
  export const create = (options: Options): KeySource => {
    const db = (options.client ?? defaults.client)();
    const client = DynamoDBDocumentClient.from(db, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });

    const TableName = options.table;

    const write = async (id: AggregateId, pair: KeyPair) => {
      const Item = {
        pk: keyFor(id),
        sk: "key_type#rsa",
        private_key: pair.privateKey.export({ type: "pkcs1", format: "pem" }),
        public_key: pair.publicKey.export({ type: "pkcs1", format: "pem" }),
      };

      const put = new PutCommand({
        TableName,
        Item,
        ConditionExpression: "attribute_not_exists(#pk)",
        ExpressionAttributeNames: {
          "#pk": "partition_key",
        },
      });

      try {
        await client.send(put);
      } catch (error) {
        // TODO: KAO ... deal with retry
        console.log(error);
      }
    };

    const read = async (id: AggregateId): Promise<KeyPair | undefined> => {
      const Key = { pk: keyFor(id), sk: "key_type#rsa" };

      const get = new GetCommand({
        TableName,
        Key,
      });

      const { Item } = await client.send(get);
      return Item === undefined
        ? undefined
        : {
            privateKey: crypto.createPrivateKey(Item.private_key),
            publicKey: crypto.createPublicKey(Item.public_key),
          };
    };

    const cache = new Map<string, KeyPair>();

    return async (id) => {
      const key = keyFor(id);

      let keyPair = cache.get(key);
      if (keyPair !== undefined) {
        return keyPair;
      }

      // has it been persisted?
      keyPair = await read(id);
      if (keyPair !== undefined) {
        cache.set(key, keyPair);
        return keyPair;
      }

      // create it
      keyPair = await generateKeyPair("rsa", { modulusLength: 2048 });
      await write(id, keyPair);
      cache.set(key, keyPair);

      return keyPair;
    };
  };
}
