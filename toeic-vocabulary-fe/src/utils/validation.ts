export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
export const PAGE_SIZE = 20;

export const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
]);

const MIME_EXTENSIONS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
};

export function normalizeEnglishWord(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function cleanText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validateAudioFile(file: File | null): string | null {
  if (!file) return null;
  if (!ALLOWED_AUDIO_TYPES.has(file.type)) {
    return "Chỉ chấp nhận file MP3, M4A, WAV, OGG hoặc WebM audio.";
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return "File audio không được vượt quá 5 MB.";
  }
  if (file.size === 0) {
    return "File audio đang rỗng.";
  }
  return null;
}

export function extensionForAudio(file: File) {
  return MIME_EXTENSIONS[file.type] || "audio";
}

export function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateVocabularyFields(
  englishWord: string,
  vietnameseMeaning: string,
) {
  const errors: { englishWord?: string; vietnameseMeaning?: string } = {};
  const english = cleanText(englishWord);
  const vietnamese = cleanText(vietnameseMeaning);

  if (!english) errors.englishWord = "Vui lòng nhập từ tiếng Anh.";
  else if (english.length > 150)
    errors.englishWord = "Từ tiếng Anh không được vượt quá 150 ký tự.";

  if (!vietnamese)
    errors.vietnameseMeaning = "Vui lòng nhập nghĩa tiếng Việt.";
  else if (vietnamese.length > 1000)
    errors.vietnameseMeaning =
      "Nghĩa tiếng Việt không được vượt quá 1.000 ký tự.";

  return errors;
}

export function sanitizeSearchTerm(value: string) {
  return cleanText(value).replace(/[,%()'"\\]/g, " ").replace(/\s+/g, " ");
}
