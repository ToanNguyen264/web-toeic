import { useQuery } from "@tanstack/react-query";
import { listVocabularies } from "../services/vocabulary.service";
import { PAGE_SIZE } from "../utils/validation";

export function useVocabularies(
  userId: string | undefined,
  search: string,
  page: number,
) {
  return useQuery({
    queryKey: ["vocabularies", userId, search, page],
    queryFn: () =>
      listVocabularies({
        userId: userId as string,
        search,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: Boolean(userId),
  });
}
