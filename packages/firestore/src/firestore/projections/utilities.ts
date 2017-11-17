import { DocumentData, DocumentReference } from "@google-cloud/firestore";

export async function position(document: DocumentReference) {
  const data = await document
    .get()
    .then(doc => doc.data())
    .catch(() => ({} as DocumentData));

  return data.position;
}
