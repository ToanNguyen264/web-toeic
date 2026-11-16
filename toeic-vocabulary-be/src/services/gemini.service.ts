import { z } from "zod";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { AI_SETTING_KEYS, getProviderApiKey } from "./app-settings.service.js";

const TOEIC_TOPICS = [
  "office",
  "meetings",
  "human-resources",
  "business-travel",
  "transportation",
  "hotels-restaurants",
  "purchasing",
  "finance",
  "customer-service",
  "marketing-sales",
  "shipping",
] as const;

const generatedExampleSchema = z.object({
  english: z.string().trim().min(1).max(500),
  vietnamese: z.string().trim().min(1).max(1000),
  topic: z.enum(TOEIC_TOPICS),
});

export type GeneratedExample = z.infer<typeof generatedExampleSchema>;

function extractOutputText(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;

  const payload = value as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: unknown }> };
    }>;
  };
  const parts = payload.candidates?.[0]?.content?.parts;
  if (!parts) return null;

  const text = parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
  return text || null;
}

function normalizeForComparison(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim();
}

export async function generateToeicExample(
  word: string,
  meaning: string,
): Promise<GeneratedExample> {
  const apiKey = await getProviderApiKey(AI_SETTING_KEYS.gemini, env.GEMINI_API_KEY);
  if (!apiKey) {
    throw new AppError(
      503,
      "Tính năng tạo câu ví dụ chưa được cấu hình.",
      "GEMINI_NOT_CONFIGURED",
    );
  }

  const prompt = [
    "Create exactly one natural TOEIC-style English example sentence and its natural Vietnamese translation.",
    `The English sentence must contain this exact vocabulary text: ${JSON.stringify(word)}.`,
    `The supplied Vietnamese meaning is: ${JSON.stringify(meaning)}.`,
    "Use only a realistic TOEIC context such as office work, meetings, HR, business travel, transportation, hotels, restaurants, purchasing, finance, customer service, marketing, sales, or shipping.",
    "Use 8 to 22 English words. Do not include explanations, markdown, quotation marks, or a second sentence.",
  ].join("\n");

  let response: Response;
  try {
    const endpoint = new URL(
      `/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`,
      env.GEMINI_API_BASE_URL,
    );
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
        "x-goog-api-client": "toeic-vocabulary/1.0.0",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
              english: {
                type: "string",
                description: "One TOEIC-style English sentence containing the exact vocabulary text.",
              },
              vietnamese: {
                type: "string",
                description: "A natural Vietnamese translation of the English sentence.",
              },
              topic: { type: "string", enum: TOEIC_TOPICS },
            },
            required: ["english", "vietnamese", "topic"],
          },
          maxOutputTokens: 300,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(env.GEMINI_TIMEOUT_MS),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      throw new AppError(504, "Gemini phản hồi quá lâu.", "GEMINI_TIMEOUT");
    }
    throw new AppError(502, "Không thể kết nối tới Gemini.", "GEMINI_UNAVAILABLE");
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AppError(
        502,
        "Gemini từ chối API key hoặc project chưa có quyền sử dụng API.",
        "GEMINI_AUTH_ERROR",
      );
    }
    if (response.status === 404) {
      throw new AppError(
        502,
        "Model Gemini đã cấu hình không khả dụng.",
        "GEMINI_MODEL_NOT_FOUND",
      );
    }
    if (response.status === 429) {
      throw new AppError(
        429,
        "Gemini đã hết quota miễn phí hoặc đang nhận quá nhiều yêu cầu.",
        "GEMINI_QUOTA_EXCEEDED",
      );
    }
    throw new AppError(502, "Gemini đang gặp lỗi.", "GEMINI_PROVIDER_ERROR");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AppError(502, "Gemini trả về dữ liệu không hợp lệ.", "GEMINI_INVALID_RESPONSE");
  }
  const rawText = extractOutputText(payload);
  if (!rawText) {
    throw new AppError(502, "Gemini không trả về câu ví dụ.", "GEMINI_INVALID_RESPONSE");
  }

  let result: GeneratedExample;
  try {
    result = generatedExampleSchema.parse(JSON.parse(rawText));
  } catch {
    throw new AppError(502, "Câu ví dụ từ Gemini không hợp lệ.", "GEMINI_INVALID_RESPONSE");
  }

  if (!normalizeForComparison(result.english).includes(normalizeForComparison(word))) {
    throw new AppError(
      502,
      "Câu ví dụ không chứa đúng từ vựng được yêu cầu.",
      "GEMINI_INVALID_RESPONSE",
    );
  }
  return result;
}
