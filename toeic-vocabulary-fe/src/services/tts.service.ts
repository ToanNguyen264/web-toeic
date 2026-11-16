import { fetchProtectedBlob } from "../lib/api";

export function generateVocabularyAudio(text: string) {
  return fetchProtectedBlob("/ai/audio", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}
