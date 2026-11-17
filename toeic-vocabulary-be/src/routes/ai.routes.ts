import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware.js";
import { generateToeicExample } from "../services/gemini.service.js";
import { generateListeningLesson, generateSpeech } from "../services/tts.service.js";

const generateAudioSchema = z.object({
  text: z
    .string()
    .transform((value) => value.normalize("NFKC").trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1).max(150)),
});

const generateExampleSchema = z.object({
  word: z.string().transform(cleanText).pipe(z.string().min(1).max(150)),
  meaning: z.string().transform(cleanText).pipe(z.string().min(1).max(1000)),
});

const generateExampleAudioSchema = z.object({
  segments: z
    .array(
      z.object({
        language: z.enum(["en", "vi"]),
        text: z.string().transform(cleanText).pipe(z.string().min(1).max(1000)),
      }),
    )
    .min(4)
    .max(14),
}).refine(
  (value) => value.segments.reduce((total, segment) => total + segment.text.length, 0) <= 4000,
  { message: "Nội dung bài giảng quá dài.", path: ["segments"] },
);

function cleanText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

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

aiRouter.post("/example", async (req, res) => {
  const { word, meaning } = generateExampleSchema.parse(req.body);
  const example = await generateToeicExample(word, meaning);
  res.setHeader("Cache-Control", "no-store");
  res.json(example);
});

aiRouter.post("/example-audio", async (req, res) => {
  const { segments } = generateExampleAudioSchema.parse(req.body);
  const audio = await generateListeningLesson(segments);

  res.type("audio/mpeg");
  res.setHeader("Content-Disposition", "inline; filename=toeic-example.mp3");
  res.setHeader("Cache-Control", "no-store");
  res.send(audio);
});
