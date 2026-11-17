import { ApiError, apiRequest, fetchProtectedBlob } from "../lib/api";
import type {
  Vocabulary,
  VocabularyFormValues,
  MasteryLevel,
  VocabularyPage,
  VocabularyStatus,
} from "../types/vocabulary";
import { PAGE_SIZE } from "../utils/validation";

type ListOptions = {
  userId: string;
  search: string;
  page: number;
  pageSize?: number;
  status: VocabularyStatus;
};

function formDataFor(values: VocabularyFormValues) {
  const formData = new FormData();
  formData.set("englishWord", values.englishWord);
  formData.set("vietnameseMeaning", values.vietnameseMeaning);
  formData.set("exampleEnglish", values.exampleEnglish);
  formData.set("exampleAnnotatedEnglish", values.exampleAnnotatedEnglish);
  formData.set("exampleVietnamese", values.exampleVietnamese);
  formData.set("exampleListeningGuide", values.exampleListeningGuide);
  formData.set("removeCurrentAudio", String(values.removeCurrentAudio));
  formData.set("removeCurrentExampleAudio", String(values.removeCurrentExampleAudio));
  if (values.audioFile) formData.set("audio", values.audioFile);
  if (values.exampleAudioFile) formData.set("exampleAudio", values.exampleAudioFile);
  return formData;
}

export async function listVocabularies({ search, page, pageSize = PAGE_SIZE, status }: ListOptions): Promise<VocabularyPage> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    status,
  });
  if (search) params.set("search", search);
  return apiRequest<VocabularyPage>(`/vocabularies?${params}`);
}

export async function listAllVocabularies(
  userId: string,
  search: string,
  status: VocabularyStatus,
) {
  const pageSize = 100;
  const firstPage = await listVocabularies({ userId, search, status, page: 1, pageSize });
  const items = [...firstPage.items];
  const totalPages = Math.ceil(firstPage.total / pageSize);

  for (let page = 2; page <= totalPages; page += 1) {
    const result = await listVocabularies({ userId, search, status, page, pageSize });
    items.push(...result.items);
  }
  return items;
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

export async function setVocabularyMastery(
  vocabularyId: string,
  masteryLevel: MasteryLevel,
) {
  const result = await apiRequest<{ item: Vocabulary }>(
    `/vocabularies/${vocabularyId}/mastery`,
    {
      method: "PATCH",
      body: JSON.stringify({ masteryLevel }),
    },
  );
  return result.item;
}

export async function getAudioUrl(vocabularyId: string, kind: "word" | "example" = "word") {
  const suffix = kind === "example" ? "/example-audio" : "/audio";
  const blob = await fetchProtectedBlob(`/vocabularies/${vocabularyId}${suffix}`);
  return URL.createObjectURL(blob);
}

export async function getWordMeaningAudioUrl(
  vocabularyId: string,
  generate: boolean,
) {
  const path = `/vocabularies/${vocabularyId}/meaning-audio`;
  let blob: Blob;
  if (generate) {
    blob = await fetchProtectedBlob(path, { method: "POST" });
  } else {
    try {
      blob = await fetchProtectedBlob(path);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
      blob = await fetchProtectedBlob(path, { method: "POST" });
    }
  }
  return URL.createObjectURL(blob);
}
