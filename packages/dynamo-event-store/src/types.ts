import { RecordedEvent } from "@weegigs/events-core";

export type EncryptedEvent = RecordedEvent & {
  encrypted: string;
};

export namespace EncryptedEvent {
  export const isEncrypted = (event: RecordedEvent): event is EncryptedEvent => "encrypted" in event;
}
