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
  created_at: string;
  updated_at: string;
};

export type VocabularyFormValues = {
  englishWord: string;
  vietnameseMeaning: string;
  audioFile: File | null;
  removeCurrentAudio: boolean;
};

export type VocabularyPage = {
  items: Vocabulary[];
  total: number;
  page: number;
  pageSize: number;
};
