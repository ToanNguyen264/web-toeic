import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/auth.middleware.js";
import {
  getAiSettingsStatus,
  updateAiSettings,
} from "../services/app-settings.service.js";

const updateAiSettingsSchema = z
  .object({
    elevenlabsApiKey: z.string().trim().min(10).max(500).optional(),
    geminiApiKey: z.string().trim().min(10).max(500).optional(),
  })
  .refine((value) => Boolean(value.elevenlabsApiKey || value.geminiApiKey), {
    message: "Hãy nhập ít nhất một API key mới.",
  });

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/ai-settings", async (_req, res) => {
  res.json(await getAiSettingsStatus());
});

adminRouter.put("/ai-settings", async (req, res) => {
  const values = updateAiSettingsSchema.parse(req.body);
  res.json(await updateAiSettings(values));
});
