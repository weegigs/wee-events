import { RecordedEvent } from "@weegigs/wee-events";

export type EncryptedEvent = RecordedEvent & {
  encrypted: string;
};

export namespace EncryptedEvent {
  export const isEncrypted = (event: RecordedEvent): event is EncryptedEvent => "encrypted" in event;
}
