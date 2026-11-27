import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import {
  getElevenLabsApiKeys,
  getElevenLabsConfigVersion,
} from "./app-settings.service.js";
import {
  synthesizeEdgeNeuralSpeech,
  synthesizeVietnameseEdgeSpeech,
} from "./vietnamese-tts.service.js";

const MAX_GENERATED_AUDIO_BYTES = 5 * 1024 * 1024;

// Default ElevenLabs premade English voices compatible with Free-tier API keys
const FREE_FALLBACK_ENGLISH_VOICES = [
  "JBFqnCBsd6RMkjVDRZzb", // George
  "EXAVITQu4vr4xnSDxMaL", // Sarah
  "cgSgspJ2msm6clMCkdW9", // Jessica
  "nPczCjzI2devNBz1zQrb", // Brian
];

export type ElevenLabsConfig = {
  apiKey: string;
  voiceId: string;
  modelId: string;
  apiBaseUrl: string;
  timeoutMs: number;
  languageCode?: "en" | "vi";
};

function supportsLanguageCode(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return lower.includes("v2_5") || lower.includes("v3") || lower.includes("v4");
}

function englishConfig(apiKey: string, voiceId = env.ELEVENLABS_VOICE_ID): ElevenLabsConfig {
  const resolvedVoice = voiceId || FREE_FALLBACK_ENGLISH_VOICES[0];
  return {
    apiKey,
    voiceId: resolvedVoice,
    modelId: env.ELEVENLABS_MODEL_ID,
    apiBaseUrl: env.ELEVENLABS_API_BASE_URL,
    timeoutMs: env.ELEVENLABS_TIMEOUT_MS,
    languageCode: "en",
  };
}

function vietnameseEnvironmentConfig(apiKey: string): ElevenLabsConfig {
  return {
    apiKey,
    voiceId: env.ELEVENLABS_VI_VOICE_ID || FREE_FALLBACK_ENGLISH_VOICES[1],
    modelId: env.ELEVENLABS_VI_MODEL_ID,
    apiBaseUrl: env.ELEVENLABS_API_BASE_URL,
    timeoutMs: env.ELEVENLABS_TIMEOUT_MS,
    languageCode: "vi",
  };
}

async function resolveFreeCompatibleVoiceId(apiKey: string, excludedVoiceId: string): Promise<string> {
  try {
    const response = await fetch(new URL("/v1/voices", env.ELEVENLABS_API_BASE_URL), {
      headers: { "xi-api-key": apiKey },
      signal: AbortSignal.timeout(8_000),
    });
    if (response.ok) {
      const data = (await response.json()) as {
        voices?: Array<{ voice_id?: string; category?: string }>;
      };
      const premade = data.voices?.find(
        (v) => v.category === "premade" && v.voice_id && v.voice_id !== excludedVoiceId,
      );
      if (premade?.voice_id) return premade.voice_id;
    }
  } catch {
    // Fall back to static premade list below
  }
  return (
    FREE_FALLBACK_ENGLISH_VOICES.find((id) => id !== excludedVoiceId) ??
    FREE_FALLBACK_ENGLISH_VOICES[0]
  );
}

async function callElevenLabsSpeechOnce(
  text: string,
  resolvedConfig: ElevenLabsConfig,
): Promise<Buffer> {
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
        ...(resolvedConfig.languageCode && supportsLanguageCode(resolvedConfig.modelId)
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
    let detailStatus = "";
    let detailMessage = "";
    try {
      const errBody = (await response.json()) as {
        detail?: { status?: string; message?: string } | string;
      };
      if (typeof errBody.detail === "string") {
        detailMessage = errBody.detail;
      } else if (errBody.detail) {
        detailStatus = errBody.detail.status ?? "";
        detailMessage = errBody.detail.message ?? "";
      }
    } catch {
      // Ignore non-JSON error body
    }

    if (
      response.status === 402 ||
      response.status === 404 ||
      detailStatus === "paid_plan_required" ||
      detailStatus === "free_users_not_allowed" ||
      detailStatus === "voice_not_found"
    ) {
      if (detailStatus === "quota_exceeded" || detailMessage.toLowerCase().includes("quota")) {
        throw new AppError(
          429,
          "API key ElevenLabs đã hết hạn mức token trong tháng.",
          "TTS_QUOTA_EXCEEDED",
        );
      }
      throw new AppError(
        402,
        "Giọng đọc này yêu cầu gói trả phí trên ElevenLabs.",
        "TTS_PAID_VOICE_REQUIRED",
      );
    }

    if (response.status === 401 || response.status === 403) {
      if (detailStatus === "quota_exceeded") {
        throw new AppError(
          429,
          "API key ElevenLabs đã hết hạn mức token.",
          "TTS_QUOTA_EXCEEDED",
        );
      }
      throw new AppError(
        502,
        detailStatus === "detected_unusual_activity"
          ? "ElevenLabs tạm khóa Free API trên địa chỉ IP này."
          : "Dịch vụ tạo audio từ chối API key.",
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

const resolvedVoiceByKeyCache = new Map<string, string>();

export async function generateSpeech(
  text: string,
  config?: ElevenLabsConfig,
): Promise<Buffer> {
  if (!config) return generateSpeechFromKeyPool(text, "en");
  if (!config.apiKey || !config.voiceId) {
    throw new AppError(
      503,
      "Tính năng tạo audio AI chưa được cấu hình.",
      "TTS_NOT_CONFIGURED",
    );
  }

  const cachedVoice =
    config.languageCode === "en" ? resolvedVoiceByKeyCache.get(config.apiKey) : undefined;
  const initialConfig = cachedVoice ? { ...config, voiceId: cachedVoice } : config;

  try {
    return await callElevenLabsSpeechOnce(text, initialConfig);
  } catch (error) {
    // Free-tier key hit a Library/Paid-only voice: auto-switch to a Free premade voice!
    if (
      error instanceof AppError &&
      error.code === "TTS_PAID_VOICE_REQUIRED" &&
      config.languageCode === "en"
    ) {
      const fallbackVoiceId = await resolveFreeCompatibleVoiceId(
        config.apiKey,
        initialConfig.voiceId,
      );
      const audio = await callElevenLabsSpeechOnce(text, {
        ...config,
        voiceId: fallbackVoiceId,
      });
      resolvedVoiceByKeyCache.set(config.apiKey, fallbackVoiceId);
      return audio;
    }
    throw error;
  }
}

async function generateEnglishEdgeFallback(text: string): Promise<Buffer> {
  return synthesizeEdgeNeuralSpeech(text, {
    voice: env.ENGLISH_FALLBACK_EDGE_VOICE,
    rate: env.ENGLISH_FALLBACK_EDGE_RATE,
    timeoutMs: env.ELEVENLABS_TIMEOUT_MS,
  });
}

let preferredElevenLabsKeyId: string | null = null;
let seenConfigVersion = -1;

async function generateSpeechFromKeyPool(text: string, language: "en" | "vi"): Promise<Buffer> {
  const currentVersion = getElevenLabsConfigVersion();
  if (currentVersion !== seenConfigVersion) {
    preferredElevenLabsKeyId = null;
    resolvedVoiceByKeyCache.clear();
    seenConfigVersion = currentVersion;
  }

  const keys = await getElevenLabsApiKeys();
  if (!keys.length) {
    if (language === "en") {
      return generateEnglishEdgeFallback(text);
    }
    throw new AppError(503, "Tính năng tạo audio AI chưa được cấu hình.", "TTS_NOT_CONFIGURED");
  }

  const orderedKeys = [...keys].sort((a, b) => {
    if (a.id === preferredElevenLabsKeyId) return -1;
    if (b.id === preferredElevenLabsKeyId) return 1;
    return 0;
  });

  let lastError: unknown;
  for (const key of orderedKeys) {
    try {
      const audio = await generateSpeech(
        text,
        language === "en" ? englishConfig(key.apiKey) : vietnameseEnvironmentConfig(key.apiKey),
      );
      preferredElevenLabsKeyId = key.id;
      return audio;
    } catch (error) {
      lastError = error;
      const canRotate =
        error instanceof AppError &&
        (error.code === "TTS_PROVIDER_AUTH_ERROR" ||
          error.code === "TTS_QUOTA_EXCEEDED" ||
          error.code === "TTS_PAID_VOICE_REQUIRED" ||
          error.code === "TTS_PROVIDER_ERROR" ||
          error.code === "TTS_TIMEOUT");
      if (!canRotate) break;
    }
  }

  // Automatic Free fallback: if ElevenLabs rejects Free keys (paid voice, IP block, quota, rate limit),
  // seamlessly synthesize English with Microsoft Edge Neural TTS so Free users are never blocked.
  if (language === "en") {
    try {
      return await generateEnglishEdgeFallback(text);
    } catch {
      // If fallback also fails, surface original ElevenLabs error below.
    }
  }

  throw lastError;
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
          "1",
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

async function generateVietnameseSpeech(text: string): Promise<Buffer> {
  if (env.VIETNAMESE_TTS_PROVIDER === "elevenlabs") {
    if (!env.ELEVENLABS_VI_VOICE_ID) {
      throw new AppError(
        503,
        "Giọng đọc tiếng Việt ElevenLabs chưa được cấu hình.",
        "TTS_VIETNAMESE_NOT_CONFIGURED",
      );
    }
    return generateSpeechFromKeyPool(text, "vi");
  }

  return synthesizeVietnameseEdgeSpeech(text, {
    voice: env.VIETNAMESE_EDGE_VOICE,
    rate: env.VIETNAMESE_EDGE_RATE,
    timeoutMs: env.ELEVENLABS_TIMEOUT_MS,
  });
}

export async function generateBilingualSpeech(
  english: string,
  vietnamese: string,
): Promise<Buffer> {
  const [englishAudio, vietnameseAudio] = await Promise.all([
    generateSpeechFromKeyPool(english, "en"),
    generateVietnameseSpeech(vietnamese),
  ]);
  return combineAudioWithPause(englishAudio, vietnameseAudio);
}

export type ListeningLessonSegment = {
  language: "en" | "vi";
  text: string;
};

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function generateSpeechWithQuotaRetry(segment: ListeningLessonSegment) {
  const retryDelays = [2_000, 4_000];
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await generateSpeechFromKeyPool(segment.text, segment.language);
    } catch (error) {
      const canRetry =
        error instanceof AppError &&
        error.code === "TTS_QUOTA_EXCEEDED" &&
        attempt < retryDelays.length;
      if (!canRetry) throw error;
      await wait(retryDelays[attempt]);
    }
  }
}

async function combineLessonAudio(audioSegments: Buffer[]): Promise<Buffer> {
  const workingDirectory = await mkdtemp(join(tmpdir(), "toeic-listening-lesson-"));
  const paths = audioSegments.map((_, index) => join(workingDirectory, `${index}.mp3`));
  const outputPath = join(workingDirectory, "lesson.mp3");
  try {
    await Promise.all(audioSegments.map((audio, index) => writeFile(paths[index], audio)));
    await new Promise<void>((resolve, reject) => {
      const pauseCount = Math.max(0, audioSegments.length - 1);
      const audioFilters = audioSegments.map(
        (_, index) =>
          `[${index}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[a${index}]`,
      );
      const pauseFilters = Array.from({ length: pauseCount }, (_, index) => {
        const inputIndex = audioSegments.length + index;
        return `[${inputIndex}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[p${index}]`;
      });
      const concatInputs = audioSegments
        .map((_, index) =>
          index < audioSegments.length - 1 ? `[a${index}][p${index}]` : `[a${index}]`,
        )
        .join("");
      const process = spawn(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          ...paths.flatMap((path) => ["-i", path]),
          ...Array.from({ length: pauseCount }, () => [
            "-f",
            "lavfi",
            "-t",
            "0.45",
            "-i",
            "anullsrc=channel_layout=stereo:sample_rate=44100",
          ]).flat(),
          "-filter_complex",
          `${[...audioFilters, ...pauseFilters].join(";")};${concatInputs}concat=n=${audioSegments.length * 2 - 1}:v=0:a=1[out]`,
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
      const timeout = setTimeout(() => process.kill("SIGKILL"), 60_000);
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
      throw new Error("Listening lesson has an invalid size");
    }
    return combinedAudio;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, "Không thể ghép audio bài giảng.", "TTS_AUDIO_COMBINE_ERROR");
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

export async function generateListeningLesson(
  segments: ListeningLessonSegment[],
): Promise<Buffer> {
  const mergedSegments = segments.reduce<ListeningLessonSegment[]>((result, segment) => {
    const previous = result.at(-1);
    if (previous?.language === segment.language) {
      previous.text = `${previous.text} ${segment.text}`;
    } else {
      result.push({ ...segment });
    }
    return result;
  }, []);

  const usesElevenLabsForVi = env.VIETNAMESE_TTS_PROVIDER === "elevenlabs";
  if (usesElevenLabsForVi && !env.ELEVENLABS_VI_VOICE_ID) {
    throw new AppError(
      503,
      "Giọng đọc tiếng Việt ElevenLabs chưa được cấu hình.",
      "TTS_VIETNAMESE_NOT_CONFIGURED",
    );
  }

  const viAudioByIndex = new Map<number, Buffer>();
  if (!usesElevenLabsForVi) {
    const viEntries = mergedSegments
      .map((segment, index) => ({ segment, index }))
      .filter((entry) => entry.segment.language === "vi");
    for (let offset = 0; offset < viEntries.length; offset += 3) {
      const batch = viEntries.slice(offset, offset + 3);
      const buffers = await Promise.all(
        batch.map((entry) => generateVietnameseSpeech(entry.segment.text)),
      );
      batch.forEach((entry, batchIdx) => {
        viAudioByIndex.set(entry.index, buffers[batchIdx]);
      });
    }
  }

  const audioSegments: Buffer[] = [];
  let hasCalledElevenLabs = false;
  for (const [index, segment] of mergedSegments.entries()) {
    const prebuiltVi = viAudioByIndex.get(index);
    if (prebuiltVi) {
      audioSegments.push(prebuiltVi);
      continue;
    }
    if (hasCalledElevenLabs) await wait(750);
    hasCalledElevenLabs = true;
    audioSegments.push(await generateSpeechWithQuotaRetry(segment));
  }
  return combineLessonAudio(audioSegments);
}
