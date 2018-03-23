import * as we from "@weegigs/events-core";

export enum RequestType {
  execute = "execute",
}

export interface Message<C extends RequestType = any, P = Object> {
  requestId: string; // ulid;
  action: C;
  payload: P;
}

export interface Response<R = Object> {
  requestId: string;
  result: we.Result<R, Error>;
}

export interface Execute extends Message<RequestType.execute, we.Command<any>> {}
