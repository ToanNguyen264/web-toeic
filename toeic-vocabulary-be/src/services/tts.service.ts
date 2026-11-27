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
import { synthesizeFreeSpeech } from "./vietnamese-tts.service.js";

const MAX_GENERATED_AUDIO_BYTES = 5 * 1024 * 1024;
const DEFAULT_FREE_ELEVENLABS_VOICE = "EXAVITQu4vr4xnSDxMaL";

export type ElevenLabsConfig = {
  apiKey: string;
  voiceId: string;
  modelId: string;
  apiBaseUrl: string;
  timeoutMs: number;
  languageCode?: "en" | "vi";
};

export type ListeningLessonSegment = {
  language: "en" | "vi";
  text: string;
};

function supportsLanguageCode(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return lower.includes("v2_5") || lower.includes("v3") || lower.includes("v4");
}

function generateFreeEnglishSpeech(text: string): Promise<Buffer> {
  return synthesizeFreeSpeech(text, {
    language: "en",
    voice: env.ENGLISH_FALLBACK_EDGE_VOICE,
    rate: env.ENGLISH_FALLBACK_EDGE_RATE,
    timeoutMs: env.ELEVENLABS_TIMEOUT_MS,
  });
}

function generateFreeVietnameseSpeech(text: string): Promise<Buffer> {
  return synthesizeFreeSpeech(text, {
    language: "vi",
    voice: env.VIETNAMESE_EDGE_VOICE,
    rate: env.VIETNAMESE_EDGE_RATE,
    timeoutMs: env.ELEVENLABS_TIMEOUT_MS,
  });
}

async function callElevenLabsSpeech(
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
    if (response.status === 401 || response.status === 403) {
      throw new AppError(502, "Dịch vụ tạo audio từ chối API key.", "TTS_PROVIDER_AUTH_ERROR");
    }
    if (response.status === 402) {
      throw new AppError(402, "Giọng đọc yêu cầu gói trả phí.", "TTS_PAID_VOICE_REQUIRED");
    }
    if (response.status === 429) {
      throw new AppError(429, "Đã hết lượt tạo audio ElevenLabs.", "TTS_QUOTA_EXCEEDED");
    }
    throw new AppError(502, "Dịch vụ tạo audio đang gặp lỗi.", "TTS_PROVIDER_ERROR");
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("audio/")) {
    throw new AppError(502, "Dữ liệu audio không hợp lệ.", "TTS_INVALID_AUDIO");
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length === 0 || audio.length > MAX_GENERATED_AUDIO_BYTES) {
    throw new AppError(502, "File audio vượt quá 5 MB hoặc rỗng.", "TTS_INVALID_AUDIO");
  }
  return audio;
}

let preferredElevenLabsKeyId: string | null = null;
let seenConfigVersion = -1;

async function generateEnglishViaConfiguredProvider(text: string): Promise<Buffer> {
  if (env.TTS_PROVIDER === "free") {
    return generateFreeEnglishSpeech(text);
  }

  const currentVersion = getElevenLabsConfigVersion();
  if (currentVersion !== seenConfigVersion) {
    preferredElevenLabsKeyId = null;
    seenConfigVersion = currentVersion;
  }

  const keys = await getElevenLabsApiKeys();
  if (!keys.length) {
    return generateFreeEnglishSpeech(text);
  }

  const orderedKeys = [...keys].sort((a, b) => {
    if (a.id === preferredElevenLabsKeyId) return -1;
    if (b.id === preferredElevenLabsKeyId) return 1;
    return 0;
  });

  for (const key of orderedKeys) {
    try {
      const audio = await callElevenLabsSpeech(text, {
        apiKey: key.apiKey,
        voiceId: env.ELEVENLABS_VOICE_ID || DEFAULT_FREE_ELEVENLABS_VOICE,
        modelId: env.ELEVENLABS_MODEL_ID,
        apiBaseUrl: env.ELEVENLABS_API_BASE_URL,
        timeoutMs: env.ELEVENLABS_TIMEOUT_MS,
        languageCode: "en",
      });
      preferredElevenLabsKeyId = key.id;
      return audio;
    } catch {
      // Try next key, then fall back to free speech below
    }
  }

  return generateFreeEnglishSpeech(text);
}

export async function generateSpeech(
  text: string,
  config?: ElevenLabsConfig,
): Promise<Buffer> {
  if (config) {
    return callElevenLabsSpeech(text, config);
  }
  return generateEnglishViaConfiguredProvider(text);
}

async function combineAudioSegmentsWithPause(
  audioSegments: Buffer[],
  pauseSeconds: number,
  errorMessage: string,
): Promise<Buffer> {
  if (audioSegments.length === 0) {
    throw new AppError(400, "Không có đoạn âm thanh nào để ghép.", "TTS_EMPTY_SEGMENTS");
  }

  const workingDirectory = await mkdtemp(join(tmpdir(), "toeic-tts-audio-"));
  const paths = audioSegments.map((_, index) => join(workingDirectory, `${index}.mp3`));
  const outputPath = join(workingDirectory, "output.mp3");

  try {
    await Promise.all(audioSegments.map((audio, index) => writeFile(paths[index], audio)));

    await new Promise<void>((resolve, reject) => {
      const filters = audioSegments.map((_, index) => {
        const padFilter =
          index < audioSegments.length - 1 ? `,apad=pad_dur=${pauseSeconds}` : "";
        return `[${index}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo${padFilter}[a${index}]`;
      });
      const concatInputs = audioSegments.map((_, index) => `[a${index}]`).join("");
      const filterComplex =
        audioSegments.length === 1
          ? `${filters[0]};[a0]anull[out]`
          : `${filters.join(";")};${concatInputs}concat=n=${audioSegments.length}:v=0:a=1[out]`;

      const child = spawn(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          ...paths.flatMap((filePath) => ["-i", filePath]),
          "-filter_complex",
          filterComplex,
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
      child.stderr.on("data", (chunk: Buffer) => {
        if (errorOutput.length < 4_000) errorOutput += chunk.toString();
      });
      const timeout = setTimeout(() => child.kill("SIGKILL"), 45_000);

      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on("close", (code) => {
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
    throw new AppError(500, errorMessage, "TTS_AUDIO_COMBINE_ERROR");
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

export async function generateBilingualSpeech(
  english: string,
  vietnamese: string,
): Promise<Buffer> {
  const [englishAudio, vietnameseAudio] = await Promise.all([
    generateEnglishViaConfiguredProvider(english),
    generateFreeVietnameseSpeech(vietnamese),
  ]);
  return combineAudioSegmentsWithPause(
    [englishAudio, vietnameseAudio],
    1,
    "Không thể ghép audio tiếng Anh và tiếng Việt.",
  );
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

  const audioSegments: Buffer[] = new Array(mergedSegments.length);
  for (let offset = 0; offset < mergedSegments.length; offset += 4) {
    const batch = mergedSegments.slice(offset, offset + 4);
    const batchBuffers = await Promise.all(
      batch.map((segment) =>
        segment.language === "vi"
          ? generateFreeVietnameseSpeech(segment.text)
          : generateEnglishViaConfiguredProvider(segment.text),
      ),
    );
    batchBuffers.forEach((buf, idx) => {
      audioSegments[offset + idx] = buf;
    });
  }

  return combineAudioSegmentsWithPause(
    audioSegments,
    0.45,
    "Không thể ghép audio bài giảng.",
  );
}
