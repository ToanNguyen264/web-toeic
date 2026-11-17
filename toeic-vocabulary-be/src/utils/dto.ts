import type { User, Vocabulary } from "@prisma/client";
import { env } from "../config/env.js";

export function userDto(user: Pick<User, "id" | "email">) {
  return {
    id: user.id,
    email: user.email,
    is_admin: user.email.toLowerCase() === env.ADMIN_EMAIL,
  };
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
    word_meaning_audio_path: vocabulary.wordMeaningAudioPath,
    word_meaning_audio_name: vocabulary.wordMeaningAudioName,
    word_meaning_audio_type: vocabulary.wordMeaningAudioType,
    word_meaning_audio_size:
      vocabulary.wordMeaningAudioSize === null
        ? null
        : Number(vocabulary.wordMeaningAudioSize),
    example_english: vocabulary.exampleEnglish,
    example_annotated_english: vocabulary.exampleAnnotatedEnglish,
    example_vietnamese: vocabulary.exampleVietnamese,
    example_listening_guide: vocabulary.exampleListeningGuide,
    example_audio_path: vocabulary.exampleAudioPath,
    example_audio_name: vocabulary.exampleAudioName,
    example_audio_type: vocabulary.exampleAudioType,
    example_audio_size:
      vocabulary.exampleAudioSize === null ? null : Number(vocabulary.exampleAudioSize),
    mastery_level: vocabulary.masteryLevel,
    is_learned: vocabulary.isLearned,
    created_at: vocabulary.createdAt.toISOString(),
    updated_at: vocabulary.updatedAt.toISOString(),
  };
}

