import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";

const MAX_GENERATED_AUDIO_BYTES = 5 * 1024 * 1024;

export type ElevenLabsConfig = {
  apiKey: string;
  voiceId: string;
  modelId: string;
  apiBaseUrl: string;
  timeoutMs: number;
};

function environmentConfig(): ElevenLabsConfig {
  return {
    apiKey: env.ELEVENLABS_API_KEY,
    voiceId: env.ELEVENLABS_VOICE_ID,
    modelId: env.ELEVENLABS_MODEL_ID,
    apiBaseUrl: env.ELEVENLABS_API_BASE_URL,
    timeoutMs: env.ELEVENLABS_TIMEOUT_MS,
  };
}

export async function generateSpeech(
  text: string,
  config: ElevenLabsConfig = environmentConfig(),
): Promise<Buffer> {
  if (!config.apiKey || !config.voiceId) {
    throw new AppError(
      503,
      "Tính năng tạo audio AI chưa được cấu hình.",
      "TTS_NOT_CONFIGURED",
    );
  }

  const url = new URL(
    `/v1/text-to-speech/${encodeURIComponent(config.voiceId)}`,
    config.apiBaseUrl,
  );
  url.searchParams.set("output_format", "mp3_44100_128");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": config.apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: config.modelId,
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      throw new AppError(504, "Dịch vụ tạo audio phản hồi quá lâu.", "TTS_TIMEOUT");
    }
    throw new AppError(
      502,
      "Không thể kết nối tới dịch vụ tạo audio.",
      "TTS_PROVIDER_UNAVAILABLE",
    );
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AppError(
        502,
        "Dịch vụ tạo audio từ chối thông tin xác thực.",
        "TTS_PROVIDER_AUTH_ERROR",
      );
    }
    if (response.status === 429) {
      throw new AppError(
        429,
        "Đã hết lượt hoặc đang tạo audio quá nhanh. Vui lòng thử lại sau.",
        "TTS_QUOTA_EXCEEDED",
      );
    }
    throw new AppError(502, "Dịch vụ tạo audio đang gặp lỗi.", "TTS_PROVIDER_ERROR");
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("audio/")) {
    throw new AppError(
      502,
      "Dịch vụ tạo audio trả về dữ liệu không hợp lệ.",
      "TTS_INVALID_AUDIO",
    );
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length === 0 || audio.length > MAX_GENERATED_AUDIO_BYTES) {
    throw new AppError(
      502,
      "File audio được tạo không hợp lệ hoặc vượt quá 5 MB.",
      "TTS_INVALID_AUDIO",
    );
  }
  return audio;
}
