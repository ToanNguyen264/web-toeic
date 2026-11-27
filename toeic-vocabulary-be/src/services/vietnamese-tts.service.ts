import { createHash, randomBytes, randomUUID } from "node:crypto";
import https from "node:https";
import type { Duplex } from "node:stream";
import { AppError } from "../errors/AppError.js";
import { isValidAudioSignature, MAX_AUDIO_BYTES } from "./audio.service.js";

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const SEC_MS_GEC_VERSION = "2-143.0.3650.96";
const EDGE_HOST = "speech.platform.bing.com";
const EDGE_PATH = "/consumer/speech/synthesize/readaloud/edge/v1";
const OUTPUT_FORMAT = "audio-24khz-96kbitrate-mono-mp3";
const EDGE_COPYRIGHT = "Copyright (C) Microsoft Corporation. All rights reserved.";
const GOOGLE_TTS_URL = "https://translate.googleapis.com/translate_tts";
const GOOGLE_MAX_CHARS = 180;

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
let edgeBlockedUntil = 0;

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

function normalizeSpeechText(text: string): string {
  return text.normalize("NFC").trim().replace(/\s+/g, " ");
}

function encodeWsClientFrame(opcode: number, payload: Buffer): Buffer {
  const maskKey = randomBytes(4);
  const len = payload.length;
  let header: Buffer;

  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  const masked = Buffer.allocUnsafe(len);
  for (let i = 0; i < len; i += 1) {
    masked[i] = payload[i] ^ maskKey[i & 3];
  }
  return Buffer.concat([header, maskKey, masked]);
}

type HandshakeError = Error & {
  statusCode?: number;
  serverDate?: string;
};

async function synthesizeEdgeOnce(
  ssml: string,
  timeoutMs: number,
): Promise<Buffer> {
  const connectionId = randomUUID().replaceAll("-", "");
  const requestId = randomBytes(16).toString("hex");
  const secMsGec = generateSecMsGec();
  const wsKey = randomBytes(16).toString("base64");
  const path =
    `${EDGE_PATH}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&Sec-MS-GEC=${secMsGec}` +
    `&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}` +
    `&ConnectionId=${connectionId}`;

  return new Promise<Buffer>((resolve, reject) => {
    let settled = false;
    let activeSocket: Duplex | null = null;
    const audioChunks: Buffer[] = [];
    let totalBytes = 0;

    function cleanup() {
      clearTimeout(timer);
      if (activeSocket && !activeSocket.destroyed) {
        activeSocket.destroy();
      }
      req.destroy();
    }

    function finishWithError(error: unknown) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    }

    const timer = setTimeout(() => {
      finishWithError(new Error("Edge TTS timed out."));
    }, Math.min(8_000, timeoutMs));

    const req = https.request({
      hostname: EDGE_HOST,
      port: 443,
      path,
      method: "GET",
      headers: {
        Host: EDGE_HOST,
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": wsKey,
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
      },
    });

    req.on("error", (err) => {
      finishWithError(err);
    });

    req.on("response", (res) => {
      res.on("error", () => {});
      res.resume();
      const handshakeErr: HandshakeError = new Error(
        `Unexpected Edge TTS HTTP status ${res.statusCode}`,
      );
      handshakeErr.statusCode = res.statusCode;
      handshakeErr.serverDate =
        typeof res.headers.date === "string" ? res.headers.date : undefined;
      finishWithError(handshakeErr);
    });

    req.on("upgrade", (_res, socket, head) => {
      activeSocket = socket;
      socket.on("error", (err) => {
        finishWithError(err);
      });

      let rxBuffer: Buffer = head && head.length > 0 ? Buffer.from(head) : Buffer.alloc(0);
      let fragOpcode = 0;
      let fragChunks: Buffer[] = [];

      function handleCompleteMessage(opcode: number, message: Buffer) {
        if (settled) return;
        if (opcode === 0x1) {
          const text = message.toString("utf8");
          if (text.includes("Path:turn.end")) {
            settled = true;
            cleanup();
            resolve(Buffer.concat(audioChunks));
          }
          return;
        }
        if (opcode === 0x2) {
          if (message.length < 2) return;
          const headerLength = message.readUInt16BE(0);
          if (message.length <= 2 + headerLength) return;
          const headerText = message.subarray(2, 2 + headerLength).toString("utf8");
          if (!headerText.includes("Path:audio")) return;

          const audioPart = Buffer.from(message.subarray(2 + headerLength));
          totalBytes += audioPart.length;
          if (totalBytes > MAX_AUDIO_BYTES) {
            finishWithError(
              new AppError(
                502,
                "File audio được tạo vượt quá giới hạn 5 MB.",
                "TTS_INVALID_AUDIO",
              ),
            );
            return;
          }
          audioChunks.push(audioPart);
        }
      }

      function processIncoming(chunk: Buffer) {
        if (settled) return;
        rxBuffer = rxBuffer.length === 0 ? chunk : Buffer.concat([rxBuffer, chunk]);

        while (rxBuffer.length >= 2 && !settled) {
          const firstByte = rxBuffer[0];
          const secondByte = rxBuffer[1];
          const fin = (firstByte & 0x80) !== 0;
          const opcode = firstByte & 0x0f;
          const masked = (secondByte & 0x80) !== 0;
          let payloadLen = secondByte & 0x7f;
          let offset = 2;

          if (payloadLen === 126) {
            if (rxBuffer.length < 4) break;
            payloadLen = rxBuffer.readUInt16BE(2);
            offset = 4;
          } else if (payloadLen === 127) {
            if (rxBuffer.length < 10) break;
            const bigLen = rxBuffer.readBigUInt64BE(2);
            if (bigLen > BigInt(MAX_AUDIO_BYTES * 2)) {
              finishWithError(new Error("WebSocket frame too large."));
              return;
            }
            payloadLen = Number(bigLen);
            offset = 10;
          }

          const maskOffset = offset;
          if (masked) offset += 4;
          if (rxBuffer.length < offset + payloadLen) break;

          const payload = Buffer.from(rxBuffer.subarray(offset, offset + payloadLen));
          if (masked) {
            for (let i = 0; i < payload.length; i += 1) {
              payload[i] ^= rxBuffer[maskOffset + (i & 3)];
            }
          }
          rxBuffer = rxBuffer.subarray(offset + payloadLen);

          if (opcode === 0x8) {
            finishWithError(new Error("Edge TTS WebSocket closed by server."));
            return;
          }
          if (opcode === 0x9) {
            if (!socket.destroyed) {
              socket.write(encodeWsClientFrame(0x0a, payload));
            }
            continue;
          }
          if (opcode === 0x0a) continue;

          if (opcode === 0x0) {
            fragChunks.push(payload);
            if (fin && fragOpcode !== 0) {
              const full = Buffer.concat(fragChunks);
              const completedOp = fragOpcode;
              fragOpcode = 0;
              fragChunks = [];
              handleCompleteMessage(completedOp, full);
            }
          } else if (fin) {
            handleCompleteMessage(opcode, payload);
          } else {
            fragOpcode = opcode;
            fragChunks = [payload];
          }
        }
      }

      socket.on("data", (chunk: Buffer) => {
        processIncoming(chunk);
      });

      socket.on("close", () => {
        if (!settled) {
          finishWithError(new Error("Edge TTS socket closed before turn.end."));
        }
      });

      if (rxBuffer.length > 0) {
        const initial = rxBuffer;
        rxBuffer = Buffer.alloc(0);
        processIncoming(initial);
      }

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

      socket.write(encodeWsClientFrame(0x1, Buffer.from(configPayload, "utf8")));
      socket.write(encodeWsClientFrame(0x1, Buffer.from(ssmlPayload, "utf8")));
    });

    req.end();
  });
}

function splitTextIntoChunks(text: string, maxLen = GOOGLE_MAX_CHARS): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    const slice = remaining.slice(0, maxLen);
    let splitIdx = Math.max(
      slice.lastIndexOf(". "),
      slice.lastIndexOf("! "),
      slice.lastIndexOf("? "),
      slice.lastIndexOf("; "),
      slice.lastIndexOf(", "),
    );
    if (splitIdx < maxLen * 0.3) {
      splitIdx = slice.lastIndexOf(" ");
    }
    if (splitIdx <= 0) {
      splitIdx = maxLen;
    } else {
      splitIdx += 1;
    }
    const part = remaining.slice(0, splitIdx).trim();
    if (part) chunks.push(part);
    remaining = remaining.slice(splitIdx).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function synthesizeGoogleFreeTts(
  text: string,
  language: "en" | "vi",
  timeoutMs: number,
): Promise<Buffer> {
  const chunks = splitTextIntoChunks(text, GOOGLE_MAX_CHARS);
  const buffers: Buffer[] = [];
  let totalBytes = 0;

  for (const chunk of chunks) {
    const url = new URL(GOOGLE_TTS_URL);
    url.searchParams.set("ie", "UTF-8");
    url.searchParams.set("client", "tw-ob");
    url.searchParams.set("tl", language === "vi" ? "vi" : "en");
    url.searchParams.set("q", chunk);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new AppError(
        502,
        "Không thể kết nối tới dịch vụ giọng đọc miễn phí.",
        "TTS_FREE_UNAVAILABLE",
      );
    }

    if (!response.ok) {
      throw new AppError(
        502,
        `Dịch vụ giọng đọc miễn phí trả về lỗi (${response.status}).`,
        "TTS_FREE_ERROR",
      );
    }

    const buf = Buffer.from(await response.arrayBuffer());
    totalBytes += buf.length;
    if (buf.length === 0 || totalBytes > MAX_AUDIO_BYTES) {
      throw new AppError(
        502,
        "Dữ liệu audio trả về không hợp lệ.",
        "TTS_INVALID_AUDIO",
      );
    }
    buffers.push(buf);
  }

  const combined = Buffer.concat(buffers);
  if (!isValidAudioSignature(combined, "audio/mpeg")) {
    throw new AppError(
      502,
      "Định dạng audio miễn phí không hợp lệ.",
      "TTS_INVALID_AUDIO",
    );
  }
  return combined;
}

export type FreeSpeechOptions = {
  language: "en" | "vi";
  voice: string;
  rate: string;
  timeoutMs: number;
};

export async function synthesizeFreeSpeech(
  rawText: string,
  options: FreeSpeechOptions,
): Promise<Buffer> {
  const normalized = normalizeSpeechText(rawText);
  if (!normalized) {
    throw new AppError(400, "Nội dung cần đọc đang trống.", "TTS_EMPTY_TEXT");
  }

  if (Date.now() >= edgeBlockedUntil) {
    const localeMatch = /\b[a-z]{2,}-[A-Z]{2}\b/.exec(options.voice);
    const xmlLang = localeMatch?.[0] ?? (options.language === "vi" ? "vi-VN" : "en-US");
    const ssml =
      `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${xmlLang}">` +
      `<voice name="${escapeXml(options.voice)}">` +
      `<prosody pitch="+0Hz" rate="${escapeXml(options.rate)}" volume="+0%">` +
      `${escapeXml(normalized)}` +
      `</prosody>` +
      `</voice>` +
      `</speak>`;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const audio = await synthesizeEdgeOnce(ssml, options.timeoutMs);
        if (audio.length > 0 && isValidAudioSignature(audio, "audio/mpeg")) {
          return audio;
        }
        break;
      } catch (error) {
        const hs = error as HandshakeError | undefined;
        if (attempt === 0 && hs?.statusCode === 403 && hs.serverDate) {
          const parsedServerTime = Date.parse(hs.serverDate);
          if (Number.isFinite(parsedServerTime)) {
            clockOffsetMs = parsedServerTime - Date.now();
            continue;
          }
        }
        if (hs?.statusCode === 401 || hs?.statusCode === 403) {
          edgeBlockedUntil = Date.now() + 30 * 60_000;
        }
        break;
      }
    }
  }

  return synthesizeGoogleFreeTts(normalized, options.language, options.timeoutMs);
}
