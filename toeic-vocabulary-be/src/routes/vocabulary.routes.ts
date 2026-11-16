import { stat } from "node:fs/promises";
import { Router } from "express";
import { AppError } from "../errors/AppError.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { uploadAudio } from "../middleware/upload.middleware.js";
import { deleteAudio, resolveAudioPath, saveAudio } from "../services/audio.service.js";
import { vocabularyDto } from "../utils/dto.js";
import {
  duplicateQuerySchema,
  idParamsSchema,
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
    ...(query.search
      ? {
          OR: [
            { englishWord: { contains: query.search } },
            { vietnameseMeaning: { contains: query.search } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.vocabulary.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.vocabulary.count({ where }),
  ]);
  res.json({ items: items.map(vocabularyDto), total, page: query.page, pageSize: query.pageSize });
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

vocabularyRouter.post("/", uploadAudio, async (req, res) => {
  const fields = vocabularyFieldsSchema.parse(req.body);
  const vocabularyId = crypto.randomUUID();
  let savedAudio: Awaited<ReturnType<typeof saveAudio>> | null = null;

  try {
    if (req.file) savedAudio = await saveAudio(req.auth!.userId, vocabularyId, req.file);
    const vocabulary = await prisma.vocabulary.create({
      data: {
        id: vocabularyId,
        userId: req.auth!.userId,
        englishWord: fields.englishWord,
        normalizedWord: normalizeEnglishWord(fields.englishWord),
        vietnameseMeaning: fields.vietnameseMeaning,
        audioPath: savedAudio?.relativePath ?? null,
        audioName: req.file?.originalname ?? null,
        audioType: req.file?.mimetype ?? null,
        audioSize: req.file?.size ?? null,
      },
    });
    res.status(201).json({ item: vocabularyDto(vocabulary) });
  } catch (error) {
    if (savedAudio) await deleteAudio(savedAudio.relativePath);
    throw error;
  }
});

vocabularyRouter.put("/:id", uploadAudio, async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const fields = vocabularyFieldsSchema.parse(req.body);
  const current = await prisma.vocabulary.findFirst({ where: { id, userId: req.auth!.userId } });
  if (!current) throw new AppError(404, "Không tìm thấy từ vựng.", "VOCABULARY_NOT_FOUND");

  let savedAudio: Awaited<ReturnType<typeof saveAudio>> | null = null;
  try {
    if (req.file) savedAudio = await saveAudio(req.auth!.userId, id, req.file);
    const clearAudio = fields.removeCurrentAudio && !savedAudio;
    const vocabulary = await prisma.vocabulary.update({
      where: { id },
      data: {
        englishWord: fields.englishWord,
        normalizedWord: normalizeEnglishWord(fields.englishWord),
        vietnameseMeaning: fields.vietnameseMeaning,
        ...(savedAudio
          ? {
              audioPath: savedAudio.relativePath,
              audioName: req.file!.originalname,
              audioType: req.file!.mimetype,
              audioSize: req.file!.size,
            }
          : clearAudio
            ? { audioPath: null, audioName: null, audioType: null, audioSize: null }
            : {}),
      },
    });
    if ((savedAudio || clearAudio) && current.audioPath) {
      await deleteAudio(current.audioPath).catch((error: unknown) => {
        req.log?.warn({ err: error, audioPath: current.audioPath }, "Could not remove replaced audio");
      });
    }
    res.json({ item: vocabularyDto(vocabulary) });
  } catch (error) {
    if (savedAudio) await deleteAudio(savedAudio.relativePath);
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
  res.status(204).send();
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

