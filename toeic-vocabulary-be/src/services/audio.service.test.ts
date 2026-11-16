import { describe, expect, it } from "vitest";
import { isValidAudioSignature } from "./audio.service.js";

describe("audio signatures", () => {
  it("accepts supported file headers", () => {
    expect(isValidAudioSignature(Buffer.from("ID3demo"), "audio/mpeg")).toBe(true);
    expect(isValidAudioSignature(Buffer.from("OggSdemo"), "audio/ogg")).toBe(true);
    expect(isValidAudioSignature(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00]), "audio/webm")).toBe(true);
    expect(isValidAudioSignature(Buffer.from("RIFF0000WAVE"), "audio/wav")).toBe(true);
    expect(isValidAudioSignature(Buffer.from("0000ftypM4A "), "audio/mp4")).toBe(true);
  });

  it("rejects a renamed non-audio file", () => {
    expect(isValidAudioSignature(Buffer.from("not really audio"), "audio/mpeg")).toBe(false);
  });
});

