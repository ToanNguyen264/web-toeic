import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { AI_SETTING_KEYS, getProviderApiKey } from "./app-settings.service.js";

const MAX_GENERATED_AUDIO_BYTES = 5 * 1024 * 1024;

export type ElevenLabsConfig = {
  apiKey: string;
  voiceId: string;
  modelId: string;
  apiBaseUrl: string;
  timeoutMs: number;
  languageCode?: "en" | "vi";
};

async function environmentConfig(): Promise<ElevenLabsConfig> {
  return {
    apiKey: await getProviderApiKey(
      AI_SETTING_KEYS.elevenlabs,
      env.ELEVENLABS_API_KEY,
    ),
    voiceId: env.ELEVENLABS_VOICE_ID,
    modelId: env.ELEVENLABS_MODEL_ID,
    apiBaseUrl: env.ELEVENLABS_API_BASE_URL,
    timeoutMs: env.ELEVENLABS_TIMEOUT_MS,
    languageCode: "en",
  };
}

function vietnameseEnvironmentConfig(apiKey: string): ElevenLabsConfig {
  return {
    apiKey,
    voiceId: env.ELEVENLABS_VI_VOICE_ID,
    modelId: env.ELEVENLABS_VI_MODEL_ID,
    apiBaseUrl: env.ELEVENLABS_API_BASE_URL,
    timeoutMs: env.ELEVENLABS_TIMEOUT_MS,
    languageCode: "vi",
  };
}

export async function generateSpeech(
  text: string,
  config?: ElevenLabsConfig,
): Promise<Buffer> {
  const resolvedConfig = config ?? (await environmentConfig());
  if (!resolvedConfig.apiKey || !resolvedConfig.voiceId) {
    throw new AppError(
      503,
      "Tính năng tạo audio AI chưa được cấu hình.",
      "TTS_NOT_CONFIGURED",
    );
  }

  const url = new URL(
    `/v1/text-to-speech/${encodeURIComponent(resolvedConfig.voiceId)}`,
    resolvedConfig.apiBaseUrl,
  );
  url.searchParams.set("output_format", "mp3_44100_128");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": resolvedConfig.apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: resolvedConfig.modelId,
        ...(resolvedConfig.languageCode
          ? { language_code: resolvedConfig.languageCode }
          : {}),
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(resolvedConfig.timeoutMs),
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
    if (response.status === 402) {
      throw new AppError(
        402,
        "Giọng đọc đã chọn yêu cầu gói ElevenLabs trả phí. Hãy chọn giọng mặc định dùng được qua Free API.",
        "TTS_PAID_VOICE_REQUIRED",
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

async function combineAudioWithPause(
  englishAudio: Buffer,
  vietnameseAudio: Buffer,
): Promise<Buffer> {
  const workingDirectory = await mkdtemp(join(tmpdir(), "toeic-example-audio-"));
  const englishPath = join(workingDirectory, "english.mp3");
  const vietnamesePath = join(workingDirectory, "vietnamese.mp3");
  const outputPath = join(workingDirectory, "combined.mp3");

  try {
    await Promise.all([
      writeFile(englishPath, englishAudio),
      writeFile(vietnamesePath, vietnameseAudio),
    ]);

    await new Promise<void>((resolve, reject) => {
      const process = spawn(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-i",
          englishPath,
          "-f",
          "lavfi",
          "-t",
          "1.5",
          "-i",
          "anullsrc=channel_layout=stereo:sample_rate=44100",
          "-i",
          vietnamesePath,
          "-filter_complex",
          "[0:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[en];" +
            "[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[pause];" +
            "[2:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[vi];" +
            "[en][pause][vi]concat=n=3:v=0:a=1[out]",
          "-map",
          "[out]",
          "-codec:a",
          "libmp3lame",
          "-b:a",
          "128k",
          outputPath,
        ],
        { stdio: ["ignore", "ignore", "pipe"] },
      );

      let errorOutput = "";
      process.stderr.on("data", (chunk: Buffer) => {
        if (errorOutput.length < 4_000) errorOutput += chunk.toString();
      });
      const timeout = setTimeout(() => process.kill("SIGKILL"), 30_000);

      process.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      process.on("close", (code) => {
        clearTimeout(timeout);
        if (code === 0) resolve();
        else reject(new Error(errorOutput || `ffmpeg exited with code ${code}`));
      });
    });

    const combinedAudio = await readFile(outputPath);
    if (combinedAudio.length === 0 || combinedAudio.length > MAX_GENERATED_AUDIO_BYTES) {
      throw new Error("Combined audio has an invalid size");
    }
    return combinedAudio;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      500,
      "Không thể ghép audio tiếng Anh và tiếng Việt.",
      "TTS_AUDIO_COMBINE_ERROR",
    );
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

export async function generateBilingualSpeech(
  english: string,
  vietnamese: string,
): Promise<Buffer> {
  const englishConfig = await environmentConfig();
  const vietnameseConfig = vietnameseEnvironmentConfig(englishConfig.apiKey);
  if (!vietnameseConfig.voiceId) {
    throw new AppError(
      503,
      "Giọng đọc tiếng Việt chưa được cấu hình.",
      "TTS_VIETNAMESE_NOT_CONFIGURED",
    );
  }

  const [englishAudio, vietnameseAudio] = await Promise.all([
    generateSpeech(english, englishConfig),
    generateSpeech(vietnamese, vietnameseConfig),
  ]);
  return combineAudioWithPause(englishAudio, vietnameseAudio);
}
