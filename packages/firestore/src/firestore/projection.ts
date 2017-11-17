import { DocumentReference } from "@google-cloud/firestore";

import {
  EventStreamOptions,
  ProjectionFunction,
  PublishedEvent,
  SerialProjection,
  Projection,
} from "@weegigs/events-core";

export class FirestoreProjection extends SerialProjection {
  constructor(document: DocumentReference, projection: ProjectionFunction, options: EventStreamOptions = {}) {
    super(projection, options);

    this.listen(async (event: PublishedEvent) => {
      await document.set({ position: event.id }, { merge: true });
    });
  }
}

export async function createFirestoreProjection(
  document: DocumentReference,
  projection: ProjectionFunction
): Promise<Projection> {
  const data = await document.get().then(doc => doc.data());

  const { position: after } = data;

  return new FirestoreProjection(document, projection, { after });
}
