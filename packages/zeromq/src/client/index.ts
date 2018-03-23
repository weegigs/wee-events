import { Dispatcher, Command, ExecuteResult } from "@weegigs/events-core";
import { socket, Socket } from "zeromq";

import { Deferred } from "../utilities/deferred";
import { DELIMITER } from "../constants";
import { execute, messageToFrames, framesToResponse } from "../messages";

export class ZeroMQDispatcher implements Dispatcher {
  private readonly dealer: Socket;
  private readonly requests: Map<string, Deferred<ExecuteResult>>;

  constructor() {
    this.dealer = socket("dealer");
    this.requests = new Map<string, Deferred<ExecuteResult>>();
  }

  connect = (server: string) => {
    this.dealer.on("message", (...frames) => {
      const [, ...body] = frames;
      const { requestId, result } = framesToResponse<any>(body);

      const deferred = this.requests.get(requestId);
      if (undefined === deferred) {
        console.log(`Received response for ${requestId} which had no associated request`);
      } else {
        deferred.resolve(result);
      }
    });

    this.dealer.connect(server);
  };

  close = () => {
    this.dealer.close();
  };

  async execute(command: Command<any>): Promise<ExecuteResult> {
    const deferred = new Deferred<ExecuteResult>();
    const request = execute(command);

    this.requests.set(request.requestId, deferred);
    this.dealer.send([DELIMITER, ...messageToFrames(request)]);

    return deferred;
  }
}
