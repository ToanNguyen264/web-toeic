import multer from "multer";
import { MAX_AUDIO_BYTES } from "../services/audio.service.js";

export const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 4 },
}).single("audio");

