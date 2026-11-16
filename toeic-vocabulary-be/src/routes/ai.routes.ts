import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware.js";
import { generateSpeech } from "../services/tts.service.js";

const generateAudioSchema = z.object({
  text: z
    .string()
    .transform((value) => value.normalize("NFKC").trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1).max(150)),
});

export const aiRouter = Router();
aiRouter.use(requireAuth);

aiRouter.post("/audio", async (req, res) => {
  const { text } = generateAudioSchema.parse(req.body);
  const audio = await generateSpeech(text);

  res.type("audio/mpeg");
  res.setHeader("Content-Disposition", "inline; filename=ai-pronunciation.mp3");
  res.setHeader("Cache-Control", "no-store");
  res.send(audio);
});
