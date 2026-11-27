import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/auth.middleware.js";
import {
  addElevenLabsKey,
  checkAllElevenLabsKeys,
  checkDefaultElevenLabsKey,
  checkPoolElevenLabsKey,
  deleteElevenLabsKey,
  getAiSettingsStatus,
  listElevenLabsKeys,
  updateAiSettings,
  updateElevenLabsKey,
} from "../services/app-settings.service.js";

const updateAiSettingsSchema = z
  .object({
    elevenlabsApiKey: z.string().trim().min(10).max(500).optional(),
    geminiApiKey: z.string().trim().min(10).max(500).optional(),
  })
  .refine((value) => Boolean(value.elevenlabsApiKey || value.geminiApiKey), {
    message: "Hãy nhập ít nhất một API key mới.",
  });

const addElevenLabsKeySchema = z.object({
  label: z.string().trim().min(1).max(80),
  apiKey: z.string().trim().min(10).max(500),
});

const updateElevenLabsKeySchema = z
  .object({
    label: z.string().trim().min(1).max(80).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((value) => value.label !== undefined || value.enabled !== undefined, {
    message: "Không có thay đổi nào để lưu.",
  });

const keyParamsSchema = z.object({ id: z.string().uuid() });

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/ai-settings", async (_req, res) => {
  res.json(await getAiSettingsStatus());
});

adminRouter.put("/ai-settings", async (req, res) => {
  const values = updateAiSettingsSchema.parse(req.body);
  res.json(await updateAiSettings(values));
});

adminRouter.get("/elevenlabs-keys", async (_req, res) => {
  res.json({ keys: await listElevenLabsKeys() });
});

adminRouter.post("/elevenlabs-keys", async (req, res) => {
  const values = addElevenLabsKeySchema.parse(req.body);
  res.status(201).json(await addElevenLabsKey(values.label, values.apiKey));
});

adminRouter.patch("/elevenlabs-keys/:id", async (req, res) => {
  const { id } = keyParamsSchema.parse(req.params);
  const values = updateElevenLabsKeySchema.parse(req.body);
  res.json({ keys: await updateElevenLabsKey(id, values) });
});

adminRouter.delete("/elevenlabs-keys/:id", async (req, res) => {
  const { id } = keyParamsSchema.parse(req.params);
  await deleteElevenLabsKey(id);
  res.status(204).send();
});

adminRouter.post("/elevenlabs-default/check", async (_req, res) => {
  res.json(await checkDefaultElevenLabsKey());
});

adminRouter.post("/elevenlabs-keys/:id/check", async (req, res) => {
  const { id } = keyParamsSchema.parse(req.params);
  res.json(await checkPoolElevenLabsKey(id));
});

adminRouter.post("/elevenlabs-check-all", async (_req, res) => {
  res.json(await checkAllElevenLabsKeys());
});
