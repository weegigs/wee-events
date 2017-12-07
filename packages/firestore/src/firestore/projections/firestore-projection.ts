import { DocumentReference, CollectionReference, DocumentData } from "@google-cloud/firestore";
import { ProjectionFunction, PublishedEvent, serialize, AggregateId } from "@weegigs/events-core";
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

const project = <T>(
  document: DocumentReference,
  projection: DocumentProjectionFunction<T>,
  options: DocumentProjectionOptions = {}
) => {
  const { merge, type, preload, remove } = {
    merge: true,
    preload: false,
    remove: false,
    ...options,
  } as DocumentProjectionOptions;

  const collection = document.collection("documents");

  return async (event: PublishedEvent): Promise<void> => {
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

function create<T>(
  document: DocumentReference,
  projection: DocumentProjectionFunction<T>,
  options: DocumentProjectionOptions = {}
): ProjectionFunction<T> {
  const process = project(document, projection, options);

  return (event: PublishedEvent<T>) => {
    return serialize(async (event: PublishedEvent<T>) => {
      await process(event);
      await document.set({ position: event.id }, { merge: true });
    })(event);
  };
}

export async function attach<T>(
  store: FirestoreEventStore,
  document: DocumentReference,
  projection: DocumentProjectionFunction<T>,
  options: DocumentProjectionOptions = {}
): Promise<Subscription> {
  const after = await position(document);
  const subscriptionOptions = { after, ...options };
  const firestoreProjection = create(document, projection, subscriptionOptions);

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
