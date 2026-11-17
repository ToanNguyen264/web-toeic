import { fetchProtectedBlob } from "../lib/api";
import { apiRequest } from "../lib/api";

export type GeneratedToeicExample = {
  english: string;
  annotatedEnglish: string;
  vietnamese: string;
  listeningGuide: string;
  topic: string;
};

export type ListeningLessonSegment = {
  language: "en" | "vi";
  text: string;
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

export function generateToeicExampleAudio(segments: ListeningLessonSegment[]) {
  return fetchProtectedBlob("/ai/example-audio", {
    method: "POST",
    body: JSON.stringify({ segments }),
  });
}
