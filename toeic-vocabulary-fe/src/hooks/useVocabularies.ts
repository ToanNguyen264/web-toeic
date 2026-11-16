import { useQuery } from "@tanstack/react-query";
import { listVocabularies } from "../services/vocabulary.service";
import { PAGE_SIZE } from "../utils/validation";
import type { VocabularyStatus } from "../types/vocabulary";

export function useVocabularies(
  userId: string | undefined,
  search: string,
  page: number,
  status: VocabularyStatus,
) {
  return useQuery({
    queryKey: ["vocabularies", userId, search, status, page],
    queryFn: () =>
      listVocabularies({
        userId: userId as string,
        search,
        status,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: Boolean(userId),
  });
}
