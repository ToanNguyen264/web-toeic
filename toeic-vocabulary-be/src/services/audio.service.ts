import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";

export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

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

function startsWithBytes(buffer: Buffer, bytes: number[], offset = 0) {
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

export function isValidAudioSignature(buffer: Buffer, mimeType: string) {
  if (buffer.length < 4) return false;
  if (mimeType === "audio/mpeg" || mimeType === "audio/mp3") {
    return buffer.subarray(0, 3).toString("ascii") === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  }
  if (mimeType === "audio/wav" || mimeType === "audio/x-wav") {
    return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WAVE";
  }
  if (mimeType === "audio/ogg") return buffer.subarray(0, 4).toString("ascii") === "OggS";
  if (mimeType === "audio/webm") return startsWithBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3]);
  if (mimeType === "audio/mp4" || mimeType === "audio/x-m4a") {
    return buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
  }
  return false;
}

export function validateAudio(file: Express.Multer.File) {
  if (!MIME_EXTENSIONS[file.mimetype]) {
    throw new AppError(400, "Chỉ chấp nhận file MP3, M4A, WAV, OGG hoặc WebM audio.", "INVALID_AUDIO_TYPE");
  }
  if (!file.size || file.size > MAX_AUDIO_BYTES) {
    throw new AppError(400, "File audio phải có dung lượng từ 1 byte đến 5 MB.", "INVALID_AUDIO_SIZE");
  }
  if (!isValidAudioSignature(file.buffer, file.mimetype)) {
    throw new AppError(400, "Nội dung file không đúng định dạng audio đã khai báo.", "INVALID_AUDIO_CONTENT");
  }
}

export async function saveAudio(userId: string, vocabularyId: string, file: Express.Multer.File) {
  validateAudio(file);
  const extension = MIME_EXTENSIONS[file.mimetype];
  const relativePath = path.join(userId, vocabularyId, `${randomUUID()}.${extension}`);
  const absolutePath = path.resolve(env.AUDIO_STORAGE_DIR, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, file.buffer, { flag: "wx" });
  return { relativePath: relativePath.replaceAll("\\", "/"), absolutePath };
}

export function resolveAudioPath(relativePath: string) {
  const root = path.resolve(env.AUDIO_STORAGE_DIR);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new AppError(400, "Đường dẫn audio không hợp lệ.", "INVALID_AUDIO_PATH");
  }
  return resolved;
}

export async function deleteAudio(relativePath: string | null) {
  if (!relativePath) return;
  await rm(resolveAudioPath(relativePath), { force: true });
}

