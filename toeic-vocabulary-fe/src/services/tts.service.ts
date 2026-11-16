import { fetchProtectedBlob } from "../lib/api";
import { apiRequest } from "../lib/api";

export type GeneratedToeicExample = {
  english: string;
  vietnamese: string;
  topic: string;
};

export function generateVocabularyAudio(text: string) {
  return fetchProtectedBlob("/ai/audio", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function generateToeicExample(word: string, meaning: string) {
  return apiRequest<GeneratedToeicExample>("/ai/example", {
    method: "POST",
    body: JSON.stringify({ word, meaning }),
  });
}

export function generateToeicExampleAudio(english: string, vietnamese: string) {
  return fetchProtectedBlob("/ai/example-audio", {
    method: "POST",
    body: JSON.stringify({ english, vietnamese }),
  });
}
