import { describe, expect, it } from "vitest";
import { cleanText, normalizeEnglishWord, vocabularyFieldsSchema } from "./validation.js";

describe("vocabulary validation", () => {
  it("normalizes spacing and casing", () => {
    expect(cleanText("  business   trip ")).toBe("business trip");
    expect(normalizeEnglishWord("  Opportunity  ")).toBe("opportunity");
  });

  it("parses multipart boolean fields", () => {
    const result = vocabularyFieldsSchema.parse({
      englishWord: " contract ",
      vietnameseMeaning: " hợp đồng ",
      removeCurrentAudio: "true",
    });
    expect(result).toEqual({
      englishWord: "contract",
      vietnameseMeaning: "hợp đồng",
      removeCurrentAudio: true,
    });
  });
});

