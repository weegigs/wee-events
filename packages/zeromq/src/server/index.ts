import { Dispatcher, Command, Result, failure } from "@weegigs/events-core";
import { Socket, socket } from "zeromq";

import { DELIMITER } from "../constants";
import { framesToMessage, RequestType, Response, responseToFrames } from "../messages";

export class ZeroMQDispatcherServer {
  private readonly socket: Socket;

  constructor(private dispatcher: Dispatcher) {
    this.socket = socket("router");

    this.socket.on("message", async (...frames) => {
      const [sender, , ...body] = frames;
      const { requestId, action, payload } = framesToMessage(body);
      try {
        await this.process(sender, requestId, action, payload);
      } catch (error) {
        this.reply(sender, requestId, failure(new Error(`"${action}" failed: ${error.message}`)));
      }
    });
  }

  listen(address: string) {
    this.socket.bind(address);
  }

  close = () => {
    this.socket.close();
  };

  private reply(sender: Buffer, requestId: string, result: Result<any, Error>) {
    const response: Response = { requestId, result };
    this.socket.send([sender, DELIMITER, ...responseToFrames(response)]);
  }

  private process = async (sender: Buffer, requestId: string, action: string, payload: any) => {
    switch (action) {
      case RequestType.execute:
        const command = payload as Command<any>;
        const result = await this.dispatcher.execute(command);
        this.reply(sender, requestId, result);
        break;

      default:
        this.reply(sender, requestId, failure(new Error(`Command "${action} not recognized`)));
        break;
    }
  };
}
