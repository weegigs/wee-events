import { DocumentReference, CollectionReference, DocumentData } from "@google-cloud/firestore";
import {
  SourceEvent,
  ProjectionFunction,
  PublishedEvent,
  serialize,
  AggregateId,
  eventId,
} from "@weegigs/events-core";
import { Subscription } from "rxjs";

import { DocumentProjectionOptions, DocumentProjectionFunction } from "../types";
import { FirestoreEventStore } from "../event-store";
import { config } from "../config";
import { position } from "./utilities";

function documentId(id: AggregateId) {
  const buffer = new Buffer(`${id.id}:${id.type}`);
  return buffer.toString("base64");
}

async function load<T extends Record<string, any>>(
  collection: CollectionReference,
  id: AggregateId
): Promise<T | undefined> {
  try {
    return collection
      .doc(documentId(id))
      .get()
      .then(d => d.data() as T);
  } catch (error) {
    // new document?
    console.log(error);
    return undefined;
  }
}

const project = <E extends SourceEvent = any>(
  document: DocumentReference,
  projection: DocumentProjectionFunction<E>,
  options: DocumentProjectionOptions = {}
) => {
  const { merge, type, preload, remove } = {
    merge: true,
    preload: false,
    remove: false,
    ...options,
  } as DocumentProjectionOptions;

  const collection = document.collection("documents");

  return async (event: PublishedEvent<E>): Promise<void> => {
    const { aggregateId: id } = event;
    if (type === undefined || type === id.type) {
      const current = preload ? await load<DocumentData>(collection, id) : undefined;
      const data = await projection(event, current);
      const doc = collection.doc(documentId(id));
      if (data) {
        await doc.set(data, { merge });
      } else if (remove === true) {
        await doc.delete();
      }
    }
  };
};

function create<E extends SourceEvent = any>(
  document: DocumentReference,
  projection: DocumentProjectionFunction<E>,
  options: DocumentProjectionOptions = {}
): ProjectionFunction<E> {
  const process = project<E>(document, projection, options);

  return (event: PublishedEvent<E>) => {
    return serialize<E>(async event => {
      await process(event);
      await document.set({ position: eventId(event) }, { merge: true });
    })(event);
  };
}

export async function attach<E extends SourceEvent = any>(
  store: FirestoreEventStore,
  document: DocumentReference,
  projection: DocumentProjectionFunction<E>,
  options: DocumentProjectionOptions = {}
): Promise<Subscription> {
  const after = await position(document);
  const subscriptionOptions = { after, ...options };
  const firestoreProjection = create<E>(document, projection, subscriptionOptions);

  return store.stream(subscriptionOptions).subscribe(
    event => firestoreProjection(event),
    error => {
      config.logger.error("event stream error", error);
    },
    () => {
      config.logger.info("event stream completed");
    }
  );
}
