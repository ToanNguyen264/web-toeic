import { createHash, randomBytes, randomUUID } from "node:crypto";
import WebSocket, { type RawData } from "ws";
import { AppError } from "../errors/AppError.js";
import { isValidAudioSignature, MAX_AUDIO_BYTES } from "./audio.service.js";

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const SEC_MS_GEC_VERSION = "2-143.0.3650.96";
const EDGE_WSS_URL =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const OUTPUT_FORMAT = "audio-24khz-96kbitrate-mono-mp3";
const EDGE_COPYRIGHT = "Copyright (C) Microsoft Corporation. All rights reserved.";

const SWAP_FIRST_WORD = {
  swappedWord: 0xef0569fb,
  swappedSum: 0x76f50f34,
  swappedProduct: 0xc3efea97,
};
const SWAP_SECOND_WORD = {
  swappedWord: 0xc31713db,
  swappedSum: 0x1881ce3c,
  swappedProduct: 0x35bd1ec9,
};
const MIX_FIRST_WORD = [0xcf98b111, 0x87085b9f, 0x12ceb96d, 0x257e1d83];
const MIX_SECOND_WORD = [0xa27416f5, 0xd38396ff, 0x7c932b89, 0xbfa49f69];

let clockOffsetMs = 0;

function swapHalves(value: number) {
  return ((value << 16) | (value >>> 16)) >>> 0;
}

function swapTerm(
  word: number,
  key: number,
  multipliers: { swappedWord: number; swappedSum: number; swappedProduct: number },
) {
  const sum =
    Math.imul(word, key) + Math.imul(swapHalves(word), multipliers.swappedWord);
  const product = Math.imul(swapHalves(sum), multipliers.swappedSum) >>> 0;
  return (Math.imul(swapHalves(product), multipliers.swappedProduct) + product) >>> 0;
}

function swapAndMultiply(value: number, multipliers: readonly number[]) {
  let acc = value;
  for (const multiplier of multipliers) {
    acc = Math.imul(swapHalves(acc), multiplier) >>> 0;
  }
  return acc;
}

function computeCs64(message: Uint8Array, digest: Buffer): Buffer {
  const firstKey = (digest.readUInt32LE(0) | 1) >>> 0;
  const secondKey = (digest.readUInt32LE(4) | 1) >>> 0;

  const padded = Buffer.alloc(Math.ceil(message.length / 8) * 8);
  padded.set(message);

  let swapSum = 0;
  let lastSwap = 0;
  let mix = 0;
  let mixSum = 0;

  for (let offset = 0; offset < padded.length; offset += 8) {
    const firstWord = padded.readUInt32LE(offset);
    const secondWord = padded.readUInt32LE(offset + 4);
    const firstSwap = swapTerm(firstWord, firstKey, SWAP_FIRST_WORD);
    lastSwap = swapTerm(secondWord, secondKey, SWAP_SECOND_WORD);
    swapSum = (swapSum + firstSwap + lastSwap) >>> 0;

    mix = swapAndMultiply(Math.imul(mix + firstWord, firstKey), MIX_FIRST_WORD);
    mixSum = (mixSum + mix) >>> 0;
    mix = swapAndMultiply(Math.imul(mix + secondWord, secondKey), MIX_SECOND_WORD);
    mixSum = (mixSum + mix) >>> 0;
  }

  const checksum = Buffer.alloc(8);
  checksum.writeUInt32LE((lastSwap ^ mix) >>> 0, 0);
  checksum.writeUInt32LE((swapSum ^ mixSum) >>> 0, 4);
  return checksum;
}

function generateSecMsGec(): string {
  const unixSeconds = Math.floor((Date.now() + clockOffsetMs) / 1000) + 11644473600;
  const roundedSeconds = unixSeconds - (unixSeconds % 300);
  const windowsTicks = roundedSeconds * 10_000_000;
  const input = `${EDGE_COPYRIGHT}${windowsTicks}${TRUSTED_CLIENT_TOKEN}`;
  const message = new TextEncoder().encode(input);
  const digest = createHash("sha256").update(message).digest();
  const cs64 = computeCs64(message, digest);
  return `${cs64.toString("hex").toUpperCase()}-${digest.toString("hex").toUpperCase()}`;
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeVietnameseText(text: string): string {
  return text.normalize("NFC").trim().replace(/\s+/g, " ");
}

function rawDataToBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}

type HandshakeError = Error & {
  statusCode?: number;
  serverDate?: string;
};

async function synthesizeOnce(
  ssml: string,
  timeoutMs: number,
): Promise<Buffer> {
  const connectionId = randomUUID().replaceAll("-", "");
  const requestId = randomBytes(16).toString("hex");
  const secMsGec = generateSecMsGec();
  const url =
    `${EDGE_WSS_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&Sec-MS-GEC=${secMsGec}` +
    `&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}` +
    `&ConnectionId=${connectionId}`;

  return new Promise<Buffer>((resolve, reject) => {
    let settled = false;
    let turnEnded = false;
    const audioChunks: Buffer[] = [];
    let totalBytes = 0;

    const ws = new WebSocket(url, {
      headers: {
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
      },
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      ws.terminate();
      reject(new AppError(504, "Dịch vụ đọc tiếng Việt phản hồi quá lâu.", "TTS_TIMEOUT"));
    }, timeoutMs);

    function finishWithError(error: unknown) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.terminate();
      }
      reject(error);
    }

    ws.once("unexpected-response", (request, response) => {
      const handshakeErr: HandshakeError = new Error(
        `Unexpected Edge TTS status ${response.statusCode}`,
      );
      handshakeErr.statusCode = response.statusCode;
      handshakeErr.serverDate =
        typeof response.headers.date === "string" ? response.headers.date : undefined;
      request.destroy();
      response.destroy();
      finishWithError(handshakeErr);
    });

    ws.once("open", () => {
      const configPayload =
        `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: {
                  sentenceBoundaryEnabled: "false",
                  wordBoundaryEnabled: "false",
                },
                outputFormat: OUTPUT_FORMAT,
              },
            },
          },
        });

      const ssmlPayload =
        `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n` +
        ssml;

      ws.send(configPayload, (configErr) => {
        if (configErr) {
          finishWithError(configErr);
          return;
        }
        ws.send(ssmlPayload, (ssmlErr) => {
          if (ssmlErr) finishWithError(ssmlErr);
        });
      });
    });

    ws.on("message", (data: RawData, isBinary: boolean) => {
      if (settled) return;
      const buffer = rawDataToBuffer(data);

      if (!isBinary) {
        const text = buffer.toString("utf8");
        if (text.includes("Path:turn.end")) {
          turnEnded = true;
          settled = true;
          clearTimeout(timer);
          ws.close();
          resolve(Buffer.concat(audioChunks));
        }
        return;
      }

      if (buffer.length < 2) return;
      const headerLength = buffer.readUInt16BE(0);
      if (buffer.length <= 2 + headerLength) return;
      const headerText = buffer.subarray(2, 2 + headerLength).toString("utf8");
      if (!headerText.includes("Path:audio")) return;

      const audioChunk = buffer.subarray(2 + headerLength);
      totalBytes += audioChunk.length;
      if (totalBytes > MAX_AUDIO_BYTES) {
        finishWithError(
          new AppError(
            502,
            "File audio tiếng Việt vượt quá giới hạn 5 MB.",
            "TTS_INVALID_AUDIO",
          ),
        );
        return;
      }
      audioChunks.push(audioChunk);
    });

    ws.once("error", (error) => {
      finishWithError(error);
    });

    ws.once("close", () => {
      if (settled) return;
      if (!turnEnded) {
        finishWithError(
          new Error("Edge TTS WebSocket closed before synthesis completed."),
        );
      }
    });
  });
}

export type EdgeNeuralTtsOptions = {
  voice: string;
  rate: string;
  timeoutMs: number;
};

export async function synthesizeEdgeNeuralSpeech(
  rawText: string,
  options: EdgeNeuralTtsOptions,
): Promise<Buffer> {
  const normalized = normalizeVietnameseText(rawText);
  if (!normalized) {
    throw new AppError(400, "Nội dung cần đọc đang trống.", "TTS_EMPTY_TEXT");
  }

  const localeMatch = /\b[a-z]{2,}-[A-Z]{2}\b/.exec(options.voice);
  const xmlLang = localeMatch?.[0] ?? "en-US";
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${xmlLang}">` +
    `<voice name="${escapeXml(options.voice)}">` +
    `<prosody pitch="+0Hz" rate="${escapeXml(options.rate)}" volume="+0%">` +
    `${escapeXml(normalized)}` +
    `</prosody>` +
    `</voice>` +
    `</speak>`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const audio = await synthesizeOnce(ssml, options.timeoutMs);
      if (audio.length === 0 || !isValidAudioSignature(audio, "audio/mpeg")) {
        throw new AppError(
          502,
          "Dịch vụ tạo giọng nói trả về dữ liệu audio không hợp lệ.",
          "TTS_INVALID_AUDIO",
        );
      }
      return audio;
    } catch (error) {
      lastError = error;
      const hs = error as HandshakeError | undefined;
      if (attempt === 0 && hs?.statusCode === 403 && hs.serverDate) {
        const parsedServerTime = Date.parse(hs.serverDate);
        if (Number.isFinite(parsedServerTime)) {
          clockOffsetMs = parsedServerTime - Date.now();
          continue;
        }
      }
      if (error instanceof AppError && error.code === "TTS_TIMEOUT") {
        throw error;
      }
    }
  }

  if (lastError instanceof AppError) throw lastError;
  throw new AppError(
    502,
    "Không thể tạo giọng đọc AI. Vui lòng thử lại sau.",
    "TTS_EDGE_PROVIDER_ERROR",
  );
}

export const synthesizeVietnameseEdgeSpeech = synthesizeEdgeNeuralSpeech;
