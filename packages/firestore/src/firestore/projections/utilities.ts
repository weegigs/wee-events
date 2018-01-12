import { DocumentData, DocumentReference } from "@google-cloud/firestore";

export async function position(document: DocumentReference): Promise<string | undefined> {
  const data = await document
    .get()
    .then(doc => doc.data() || {})
    .catch(() => ({} as DocumentData));

  return data.position;
}
