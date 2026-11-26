import { useQuery } from "@tanstack/react-query";
import { listFlashcardVocabularies } from "../services/vocabulary.service";
import type { VocabularyStatus } from "../types/vocabulary";

export function useFlashcardPool(
  userId: string | undefined,
  search: string,
  status: VocabularyStatus,
  roundSeed: number,
) {
  return useQuery({
    queryKey: ["flashcard-pool", userId, search, status, roundSeed],
    queryFn: () => listFlashcardVocabularies(userId as string, search, status),
    enabled: Boolean(userId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
