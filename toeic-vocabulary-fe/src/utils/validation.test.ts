import { describe, expect, it } from "vitest";
import {
  MAX_AUDIO_BYTES,
  cleanText,
  normalizeEnglishWord,
  sanitizeSearchTerm,
  validateAudioFile,
  validateEmail,
  validateVocabularyFields,
} from "./validation";

describe("validation helpers", () => {
  it("normalizes an English word consistently", () => {
    expect(normalizeEnglishWord("  Customer   Service ")).toBe(
      "customer service",
    );
  });

  it("cleans repeated whitespace", () => {
    expect(cleanText("  cuộc   họp  ")).toBe("cuộc họp");
  });

  it("validates email format", () => {
    expect(validateEmail("learner@example.com")).toBe(true);
    expect(validateEmail("invalid-email")).toBe(false);
  });

  it("requires both vocabulary fields", () => {
    expect(validateVocabularyFields("", "")).toEqual({
      englishWord: "Vui lòng nhập từ tiếng Anh.",
      vietnameseMeaning: "Vui lòng nhập nghĩa tiếng Việt.",
    });
  });

  it("rejects an oversized audio file", () => {
    const file = new File([new Uint8Array(MAX_AUDIO_BYTES + 1)], "large.mp3", {
      type: "audio/mpeg",
    });
    expect(validateAudioFile(file)).toBe(
      "File audio không được vượt quá 5 MB.",
    );
  });

  it("removes PostgREST control characters from search", () => {
    expect(sanitizeSearchTerm("word,(test)'value")).toBe("word test value");
  });
});
