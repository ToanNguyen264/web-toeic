export type Vocabulary = {
  id: string;
  user_id: string;
  english_word: string;
  normalized_word: string;
  vietnamese_meaning: string;
  audio_path: string | null;
  audio_name: string | null;
  audio_type: string | null;
  audio_size: number | null;
  word_meaning_audio_path: string | null;
  word_meaning_audio_name: string | null;
  word_meaning_audio_type: string | null;
  word_meaning_audio_size: number | null;
  example_english: string | null;
  example_annotated_english: string | null;
  example_vietnamese: string | null;
  example_audio_path: string | null;
  example_audio_name: string | null;
  example_audio_type: string | null;
  example_audio_size: number | null;
  mastery_level: MasteryLevel;
  is_learned: boolean;
  last_reviewed_at: string | null;
  review_count: number;
  created_at: string;
  updated_at: string;
};

export type VocabularyFormValues = {
  englishWord: string;
  vietnameseMeaning: string;
  audioFile: File | null;
  removeCurrentAudio: boolean;
  exampleEnglish: string;
  exampleAnnotatedEnglish: string;
  exampleVietnamese: string;
  exampleAudioFile: File | null;
  removeCurrentExampleAudio: boolean;
};

export type VocabularyPage = {
  items: Vocabulary[];
  total: number;
  page: number;
  pageSize: number;
  stats: {
    unlearned: number;
    learning: number;
    mastered: number;
  };
};

export type MasteryLevel = "unlearned" | "learning" | "mastered";

export type VocabularyStatus = "all" | MasteryLevel;

export type VocabularySort = "newest" | "review_priority";

export type FlashcardPool = {
  items: Vocabulary[];
  stats: {
    unlearned: number;
    learning: number;
    mastered: number;
  };
};
