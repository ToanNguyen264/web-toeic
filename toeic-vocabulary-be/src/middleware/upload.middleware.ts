import type { Request } from "express";
import multer from "multer";
import { MAX_AUDIO_BYTES } from "../services/audio.service.js";

export const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 2, fields: 8 },
}).fields([
  { name: "audio", maxCount: 1 },
  { name: "exampleAudio", maxCount: 1 },
]);

export function uploadedAudio(req: Request, field: "audio" | "exampleAudio") {
  if (!req.files || Array.isArray(req.files)) return undefined;
  return req.files[field]?.[0];
}

