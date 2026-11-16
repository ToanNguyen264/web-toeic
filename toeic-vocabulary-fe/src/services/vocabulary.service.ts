import { apiRequest, fetchProtectedBlob } from "../lib/api";
import type { Vocabulary, VocabularyFormValues, VocabularyPage } from "../types/vocabulary";
import { PAGE_SIZE } from "../utils/validation";

type ListOptions = {
  userId: string;
  search: string;
  page: number;
  pageSize?: number;
};

function formDataFor(values: VocabularyFormValues) {
  const formData = new FormData();
  formData.set("englishWord", values.englishWord);
  formData.set("vietnameseMeaning", values.vietnameseMeaning);
  formData.set("exampleEnglish", values.exampleEnglish);
  formData.set("exampleVietnamese", values.exampleVietnamese);
  formData.set("removeCurrentAudio", String(values.removeCurrentAudio));
  formData.set("removeCurrentExampleAudio", String(values.removeCurrentExampleAudio));
  if (values.audioFile) formData.set("audio", values.audioFile);
  if (values.exampleAudioFile) formData.set("exampleAudio", values.exampleAudioFile);
  return formData;
}

export async function listVocabularies({ search, page, pageSize = PAGE_SIZE }: ListOptions): Promise<VocabularyPage> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set("search", search);
  return apiRequest<VocabularyPage>(`/vocabularies?${params}`);
}

export async function hasDuplicateVocabulary(_userId: string, englishWord: string, excludeId?: string) {
  const params = new URLSearchParams({ word: englishWord });
  if (excludeId) params.set("excludeId", excludeId);
  const result = await apiRequest<{ duplicate: boolean }>(`/vocabularies/check-duplicate?${params}`);
  return result.duplicate;
}

export async function createVocabulary(_userId: string, values: VocabularyFormValues) {
  const result = await apiRequest<{ item: Vocabulary }>("/vocabularies", {
    method: "POST",
    body: formDataFor(values),
  });
  return result.item;
}

export async function updateVocabulary(_userId: string, current: Vocabulary, values: VocabularyFormValues) {
  const result = await apiRequest<{ item: Vocabulary }>(`/vocabularies/${current.id}`, {
    method: "PUT",
    body: formDataFor(values),
  });
  return result.item;
}

export async function deleteVocabulary(_userId: string, vocabulary: Vocabulary) {
  await apiRequest<void>(`/vocabularies/${vocabulary.id}`, { method: "DELETE" });
}

export async function getAudioUrl(vocabularyId: string, kind: "word" | "example" = "word") {
  const suffix = kind === "example" ? "/example-audio" : "/audio";
  const blob = await fetchProtectedBlob(`/vocabularies/${vocabularyId}${suffix}`);
  return URL.createObjectURL(blob);
}
