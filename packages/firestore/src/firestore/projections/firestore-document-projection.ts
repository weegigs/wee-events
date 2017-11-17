import { DocumentReference, CollectionReference, DocumentData } from "@google-cloud/firestore";

import { AggregateId, PublishedEvent, Projection } from "@weegigs/events-core";

import { DocumentProjectionFunction, DocumentProjectionOptions } from "../types";

import { FirestoreProjection } from "./firestore-projection";
import { position } from "./utilities";

export class FirestoreDocumentProjection extends FirestoreProjection {
  private documents: CollectionReference;

  constructor(
    document: DocumentReference,
    projection: DocumentProjectionFunction,
    options: DocumentProjectionOptions = {}
  ) {
    const { merge, type, preload } = {
      merge: true,
      preload: false,
      ...options,
    } as DocumentProjectionOptions;
    const documentProjection = async (event: PublishedEvent): Promise<void> => {
      const { aggregateId: id } = event;
      if (type === undefined || type === id.type) {
        const current = preload ? await this.get<DocumentData>(id) : undefined;
        const data = await projection(event, current);
        if (data) {
          const doc = this.documents.doc(key(id));
          await doc.set(data, { merge });
        }
      }
    };

    super(document, documentProjection, options);

    this.documents = document.collection("documents");
  }

  async get<T extends Record<string, any>>(id: AggregateId): Promise<T | undefined> {
    try {
      return this.documents
        .doc(key(id))
        .get()
        .then(d => d.data() as T);
    } catch (error) {
      // new document?
      console.log(error);
      return undefined;
    }
  }
}

export async function createFirestoreDocumentProjection(
  document: DocumentReference,
  projection: DocumentProjectionFunction,
  options: DocumentProjectionOptions = {}
): Promise<Projection> {
  const after = await position(document);
  return new FirestoreDocumentProjection(document, projection, { after, ...options });
}

export function key(id: AggregateId) {
  const buffer = new Buffer(`${id.id}:${id.type}`);
  return buffer.toString("base64");
}
