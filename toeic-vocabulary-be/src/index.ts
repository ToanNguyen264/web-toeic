import { mkdir } from "node:fs/promises";
import { env } from "./config/env.js";
import { app } from "./app.js";
import { prisma } from "./lib/prisma.js";

await mkdir(env.AUDIO_STORAGE_DIR, { recursive: true });

const server = app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`TOEIC Vocabulary API đang chạy tại http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal}: đang dừng máy chủ...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

