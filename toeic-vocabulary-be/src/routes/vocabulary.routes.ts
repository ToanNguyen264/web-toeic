import { stat } from "node:fs/promises";
import { Router } from "express";
import { AppError } from "../errors/AppError.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { uploadAudio, uploadedAudio } from "../middleware/upload.middleware.js";
import { deleteAudio, resolveAudioPath, saveAudio } from "../services/audio.service.js";
import { vocabularyDto } from "../utils/dto.js";
import {
  duplicateQuerySchema,
  idParamsSchema,
  learnedStatusSchema,
  listQuerySchema,
  normalizeEnglishWord,
  vocabularyFieldsSchema,
} from "../utils/validation.js";

export const vocabularyRouter = Router();
vocabularyRouter.use(requireAuth);

vocabularyRouter.get("/", async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const where = {
    userId: req.auth!.userId,
    ...(query.status === "all" ? {} : { isLearned: query.status === "learned" }),
    ...(query.search
      ? {
          OR: [
            { englishWord: { contains: query.search } },
            { vietnameseMeaning: { contains: query.search } },
            { exampleEnglish: { contains: query.search } },
            { exampleVietnamese: { contains: query.search } },
          ],
        }
      : {}),
  };
  const [items, total, unlearned, learned] = await prisma.$transaction([
    prisma.vocabulary.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.vocabulary.count({ where }),
    prisma.vocabulary.count({
      where: { userId: req.auth!.userId, isLearned: false },
    }),
    prisma.vocabulary.count({
      where: { userId: req.auth!.userId, isLearned: true },
    }),
  ]);
  res.json({
    items: items.map(vocabularyDto),
    total,
    page: query.page,
    pageSize: query.pageSize,
    stats: { unlearned, learned },
  });
});

vocabularyRouter.get("/check-duplicate", async (req, res) => {
  const query = duplicateQuerySchema.parse(req.query);
  const item = await prisma.vocabulary.findFirst({
    where: {
      userId: req.auth!.userId,
      normalizedWord: normalizeEnglishWord(query.word),
      ...(query.excludeId ? { id: { not: query.excludeId } } : {}),
    },
    select: { id: true },
  });
  res.json({ duplicate: Boolean(item) });
});

vocabularyRouter.patch("/:id/learned", async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const { isLearned } = learnedStatusSchema.parse(req.body);
  const current = await prisma.vocabulary.findFirst({
    where: { id, userId: req.auth!.userId },
    select: { id: true },
  });
  if (!current) {
    throw new AppError(404, "Không tìm thấy từ vựng.", "VOCABULARY_NOT_FOUND");
  }

  const vocabulary = await prisma.vocabulary.update({
    where: { id },
    data: { isLearned },
  });
  res.json({ item: vocabularyDto(vocabulary) });
});

vocabularyRouter.post("/", uploadAudio, async (req, res) => {
  const fields = vocabularyFieldsSchema.parse(req.body);
  const vocabularyId = crypto.randomUUID();
  const audioFile = uploadedAudio(req, "audio");
  const exampleAudioFile = uploadedAudio(req, "exampleAudio");
  let savedAudio: Awaited<ReturnType<typeof saveAudio>> | null = null;
  let savedExampleAudio: Awaited<ReturnType<typeof saveAudio>> | null = null;

  try {
    if (audioFile) savedAudio = await saveAudio(req.auth!.userId, vocabularyId, audioFile);
    if (exampleAudioFile) {
      savedExampleAudio = await saveAudio(req.auth!.userId, vocabularyId, exampleAudioFile);
    }
    const vocabulary = await prisma.vocabulary.create({
      data: {
        id: vocabularyId,
        userId: req.auth!.userId,
        englishWord: fields.englishWord,
        normalizedWord: normalizeEnglishWord(fields.englishWord),
        vietnameseMeaning: fields.vietnameseMeaning,
        audioPath: savedAudio?.relativePath ?? null,
        audioName: audioFile?.originalname ?? null,
        audioType: audioFile?.mimetype ?? null,
        audioSize: audioFile?.size ?? null,
        exampleEnglish: fields.exampleEnglish || null,
        exampleVietnamese: fields.exampleVietnamese || null,
        exampleAudioPath: savedExampleAudio?.relativePath ?? null,
        exampleAudioName: exampleAudioFile?.originalname ?? null,
        exampleAudioType: exampleAudioFile?.mimetype ?? null,
        exampleAudioSize: exampleAudioFile?.size ?? null,
      },
    });
    res.status(201).json({ item: vocabularyDto(vocabulary) });
  } catch (error) {
    if (savedAudio) await deleteAudio(savedAudio.relativePath);
    if (savedExampleAudio) await deleteAudio(savedExampleAudio.relativePath);
    throw error;
  }
});

vocabularyRouter.put("/:id", uploadAudio, async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const fields = vocabularyFieldsSchema.parse(req.body);
  const current = await prisma.vocabulary.findFirst({ where: { id, userId: req.auth!.userId } });
  if (!current) throw new AppError(404, "Không tìm thấy từ vựng.", "VOCABULARY_NOT_FOUND");

  const audioFile = uploadedAudio(req, "audio");
  const exampleAudioFile = uploadedAudio(req, "exampleAudio");
  let savedAudio: Awaited<ReturnType<typeof saveAudio>> | null = null;
  let savedExampleAudio: Awaited<ReturnType<typeof saveAudio>> | null = null;
  try {
    if (audioFile) savedAudio = await saveAudio(req.auth!.userId, id, audioFile);
    if (exampleAudioFile) {
      savedExampleAudio = await saveAudio(req.auth!.userId, id, exampleAudioFile);
    }
    const clearAudio = fields.removeCurrentAudio && !savedAudio;
    const exampleChanged =
      fields.exampleEnglish !== (current.exampleEnglish ?? "") ||
      fields.exampleVietnamese !== (current.exampleVietnamese ?? "");
    const clearExampleAudio =
      !savedExampleAudio &&
      (fields.removeCurrentExampleAudio || !fields.exampleEnglish || exampleChanged);
    const vocabulary = await prisma.vocabulary.update({
      where: { id },
      data: {
        englishWord: fields.englishWord,
        normalizedWord: normalizeEnglishWord(fields.englishWord),
        vietnameseMeaning: fields.vietnameseMeaning,
        exampleEnglish: fields.exampleEnglish || null,
        exampleVietnamese: fields.exampleVietnamese || null,
        ...(savedAudio
          ? {
              audioPath: savedAudio.relativePath,
              audioName: audioFile!.originalname,
              audioType: audioFile!.mimetype,
              audioSize: audioFile!.size,
            }
          : clearAudio
            ? { audioPath: null, audioName: null, audioType: null, audioSize: null }
            : {}),
        ...(savedExampleAudio
          ? {
              exampleAudioPath: savedExampleAudio.relativePath,
              exampleAudioName: exampleAudioFile!.originalname,
              exampleAudioType: exampleAudioFile!.mimetype,
              exampleAudioSize: exampleAudioFile!.size,
            }
          : clearExampleAudio
            ? {
                exampleAudioPath: null,
                exampleAudioName: null,
                exampleAudioType: null,
                exampleAudioSize: null,
              }
            : {}),
      },
    });
    if ((savedAudio || clearAudio) && current.audioPath) {
      await deleteAudio(current.audioPath).catch((error: unknown) => {
        req.log?.warn({ err: error, audioPath: current.audioPath }, "Could not remove replaced audio");
      });
    }
    if ((savedExampleAudio || clearExampleAudio) && current.exampleAudioPath) {
      await deleteAudio(current.exampleAudioPath).catch((error: unknown) => {
        req.log?.warn(
          { err: error, audioPath: current.exampleAudioPath },
          "Could not remove replaced example audio",
        );
      });
    }
    res.json({ item: vocabularyDto(vocabulary) });
  } catch (error) {
    if (savedAudio) await deleteAudio(savedAudio.relativePath);
    if (savedExampleAudio) await deleteAudio(savedExampleAudio.relativePath);
    throw error;
  }
});

vocabularyRouter.delete("/:id", async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const current = await prisma.vocabulary.findFirst({ where: { id, userId: req.auth!.userId } });
  if (!current) throw new AppError(404, "Không tìm thấy từ vựng.", "VOCABULARY_NOT_FOUND");

  await prisma.vocabulary.delete({ where: { id } });
  await deleteAudio(current.audioPath).catch((error: unknown) => {
    req.log?.warn({ err: error, audioPath: current.audioPath }, "Could not remove deleted audio");
  });
  await deleteAudio(current.exampleAudioPath).catch((error: unknown) => {
    req.log?.warn(
      { err: error, audioPath: current.exampleAudioPath },
      "Could not remove deleted example audio",
    );
  });
  res.status(204).send();
});

vocabularyRouter.get("/:id/example-audio", async (req, res, next) => {
  const { id } = idParamsSchema.parse(req.params);
  const current = await prisma.vocabulary.findFirst({ where: { id, userId: req.auth!.userId } });
  if (!current?.exampleAudioPath) {
    throw new AppError(404, "Từ vựng này chưa có audio ví dụ.", "EXAMPLE_AUDIO_NOT_FOUND");
  }

  const absolutePath = resolveAudioPath(current.exampleAudioPath);
  try {
    await stat(absolutePath);
  } catch {
    throw new AppError(404, "Không tìm thấy file audio ví dụ.", "EXAMPLE_AUDIO_FILE_NOT_FOUND");
  }
  res.type(current.exampleAudioType ?? "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(current.exampleAudioName ?? "example-audio")}`,
  );
  res.setHeader("Cache-Control", "private, max-age=300");
  res.sendFile(absolutePath, (error) => {
    if (error) next(error);
  });
});

vocabularyRouter.get("/:id/audio", async (req, res, next) => {
  const { id } = idParamsSchema.parse(req.params);
  const current = await prisma.vocabulary.findFirst({ where: { id, userId: req.auth!.userId } });
  if (!current?.audioPath) throw new AppError(404, "Từ vựng này chưa có audio.", "AUDIO_NOT_FOUND");

  const absolutePath = resolveAudioPath(current.audioPath);
  try {
    await stat(absolutePath);
  } catch {
    throw new AppError(404, "Không tìm thấy file audio.", "AUDIO_FILE_NOT_FOUND");
  }
  res.type(current.audioType ?? "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(current.audioName ?? "audio")}`);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.sendFile(absolutePath, (error) => {
    if (error) next(error);
  });
});

