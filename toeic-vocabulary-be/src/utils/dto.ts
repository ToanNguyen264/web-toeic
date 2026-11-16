import type { User, Vocabulary } from "@prisma/client";

export function userDto(user: Pick<User, "id" | "email">) {
  return { id: user.id, email: user.email };
}

export function vocabularyDto(vocabulary: Vocabulary) {
  return {
    id: vocabulary.id,
    user_id: vocabulary.userId,
    english_word: vocabulary.englishWord,
    normalized_word: vocabulary.normalizedWord,
    vietnamese_meaning: vocabulary.vietnameseMeaning,
    audio_path: vocabulary.audioPath,
    audio_name: vocabulary.audioName,
    audio_type: vocabulary.audioType,
    audio_size: vocabulary.audioSize === null ? null : Number(vocabulary.audioSize),
    created_at: vocabulary.createdAt.toISOString(),
    updated_at: vocabulary.updatedAt.toISOString(),
  };
}

