import * as moment from "moment";
import * as _ from "lodash";

import { Command, success, failure } from "@weegigs/events-core";
import { monotonicFactory, decodeTime } from "ulid";

import * as t from "./types";

const ulid = monotonicFactory();

export function messageToFrames(message: t.Message<any>): Buffer[] {
  const payload = JSON.stringify(message.payload);

  const frames: string[] = [message.requestId, message.action, payload];
  return frames.map(frame => Buffer.from(frame));
}

export function framesToMessage<C extends t.RequestType = any>(frames: Buffer[]): t.Message<C> {
  if (frames.length !== 3) {
    throw new Error(`Unexpected frame count: ${frames.length}`);
  }

  const [requestId, command, payload] = frames.map(frame => frame.toString());

  return {
    requestId,
    action: command as any,
    payload: JSON.parse(payload),
  };
}

export function responseToFrames(response: t.Response<any>): Buffer[] {
  const { requestId, result } = response;

  let payload;
  result.with(
    result => {
      payload = { success: result };
    },
    error => {
      payload = { failure: { name: error.name, message: error.message } };
    }
  );

  const frames: string[] = [requestId, JSON.stringify(payload)];
  return frames.map(frame => Buffer.from(frame));
}

export function framesToResponse<T>(frames: Buffer[]): t.Response<T> {
  if (frames.length !== 2) {
    throw new Error(`Unexpected frame count: ${frames.length}`);
  }

  const [requestId, response] = frames.map(frame => frame.toString());
  const { success: s, failure: f } = JSON.parse(response);

  const result = s !== undefined ? success(s) : failure(new Error(f.message));

  return {
    requestId,
    result,
  };
}

export function timestamp(message: t.Message<any>): Date {
  const { requestId } = message;
  return moment.utc(decodeTime(requestId)).toDate();
}

export function verifyCommand(source: Command): Command {
  const { aggregateId, command, data } = source;

  if (undefined === (aggregateId as any)) {
    throw new Error("Expected command aggregate id");
  }

  if (_.isEmpty(command)) {
    throw new Error("Expected command identifer");
  }

  if (undefined === data) {
    throw new Error("Expected command data");
  }

  return {
    aggregateId,
    command,
    data,
  };
}

export function executePayload(command: Command): t.Execute {
  return {
    requestId: ulid(),
    action: t.RequestType.execute,
    payload: verifyCommand(command),
  };
}
