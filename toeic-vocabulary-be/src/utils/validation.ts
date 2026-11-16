import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(72),
});

const booleanFormField = z
  .union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")])
  .default(false);

export const vocabularyFieldsSchema = z
  .object({
    englishWord: z.string().transform(cleanText).pipe(z.string().min(1).max(150)),
    vietnameseMeaning: z
      .string()
      .transform(cleanText)
      .pipe(z.string().min(1).max(1000)),
    exampleEnglish: z.string().default("").transform(cleanText).pipe(z.string().max(500)),
    exampleVietnamese: z.string().default("").transform(cleanText).pipe(z.string().max(1000)),
    removeCurrentAudio: booleanFormField,
    removeCurrentExampleAudio: booleanFormField,
  })
  .superRefine((value, context) => {
    if (Boolean(value.exampleEnglish) !== Boolean(value.exampleVietnamese)) {
      context.addIssue({
        code: "custom",
        path: value.exampleEnglish ? ["exampleVietnamese"] : ["exampleEnglish"],
        message: "Câu ví dụ tiếng Anh và nghĩa tiếng Việt phải được nhập cùng nhau.",
      });
    }
  });

export const listQuerySchema = z.object({
  search: z.string().max(150).default("").transform(cleanText),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const duplicateQuerySchema = z.object({
  word: z.string().transform(cleanText).pipe(z.string().min(1).max(150)),
  excludeId: z.string().uuid().optional(),
});

export const idParamsSchema = z.object({ id: z.string().uuid() });

export function cleanText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function normalizeEnglishWord(value: string) {
  return cleanText(value).toLowerCase();
}

