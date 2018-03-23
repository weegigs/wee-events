import * as path from "path";
import * as R from "ramda";

import {
  Dispatcher,
  Command,
  ExecuteResult,
  failure,
  success,
  AggregateVersion,
} from "@weegigs/events-core";
import { Subscription } from "rxjs";
import { config } from "dotenv";
import { Socket, socket } from "zeromq";
import { promisify } from "util";

import { ZeroMQDispatcherServer } from "../src/server";
import { ZeroMQDispatcher } from "../src/client";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;

config();

const after = promisify(setTimeout);

const delayCommand = (id: string, delay: number = 0): Command<number> => ({
  command: "delay",
  aggregateId: { id, type: "test" },
  data: delay,
});

class TestDelayDispatcher implements Dispatcher {
  async execute(command: Command<any>): Promise<ExecuteResult> {
    const delay = Number.parseInt(command.data);
    if (isNaN(delay)) {
      return failure(new Error("We failed"));
    } else {
      const events = [];
      const version: AggregateVersion = {
        id: command.aggregateId,
        version: undefined,
        events,
      };
      const result = success({ events, version });
      return delay === 0 ? result : after(delay, result);
    }
  }
}

describe("Sending requests", () => {
  const address = "tcp://127.0.0.1:8000";

  let dispatcher: Dispatcher;
  let client: ZeroMQDispatcher;
  let server: ZeroMQDispatcherServer;

  beforeAll(async () => {
    dispatcher = new TestDelayDispatcher();
    server = new ZeroMQDispatcherServer(dispatcher);
    client = new ZeroMQDispatcher();

    server.listen(address);
    client.connect(address);
  });

  afterAll(async () => {
    await server.close();
    await client.close();
  });

  it("dispatches messages", async () => {
    const result = await client.execute(delayCommand("immediate"));
    expect(result.value).toBeDefined();
  });

  it("dispatches messages in parallel", async () => {
    const results = [];

    const commands = [1250, 1000, 750, 500, 250, 10].map(delay => {
      return client.execute(delayCommand(`${delay}`, delay)).then(r => {
        const id = r.value.version.id.id;
        results.push(id);
        return id;
      });
    });
    const done = await Promise.all(commands);

    expect(results).toEqual(["10", "250", "500", "750", "1000", "1250"]);
  });
});
