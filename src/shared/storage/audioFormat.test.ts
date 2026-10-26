import { describe, expect, it } from "vitest";
import { isStandaloneAudioFile } from "./audioFormat";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)).concat(Array(16).fill(0)));

describe("isStandaloneAudioFile", () => {
  it("accepts complete webm, mp4, ogg and mp3 files", () => {
    expect(isStandaloneAudioFile(bytes([0x1a, 0x45, 0xdf, 0xa3]))).toBe(true);
    expect(isStandaloneAudioFile(bytes([0, 0, 0, 0x1c], "ftypiso5"))).toBe(true);
    expect(isStandaloneAudioFile(bytes("OggS"))).toBe(true);
    expect(isStandaloneAudioFile(bytes("ID3"))).toBe(true);
  });

  it("rejects fragmented mp4 segments, html and short buffers", () => {
    expect(isStandaloneAudioFile(bytes([0, 0, 0, 0x18], "stypmsdh"))).toBe(false);
    expect(isStandaloneAudioFile(bytes("<!DOCTYPE html>"))).toBe(false);
    expect(isStandaloneAudioFile(new Uint8Array([0x1a, 0x45]))).toBe(false);
  });

  it("accepts real mpeg audio frame headers", () => {
    expect(isStandaloneAudioFile(bytes([0xff, 0xfb, 0x90, 0x64]))).toBe(true); // mpeg-1 layer iii, 128 kbps, 44.1 khz
    expect(isStandaloneAudioFile(bytes([0xff, 0xf3, 0x64, 0xc4]))).toBe(true); // mpeg-2 layer iii
  });

  it("rejects buffers that only look like an mpeg frame sync", () => {
    expect(isStandaloneAudioFile(bytes([0xff, 0xff, 0xff, 0xff]))).toBe(false); // bad bitrate index
    expect(isStandaloneAudioFile(bytes([0xff, 0xeb, 0x90, 0x64]))).toBe(false); // reserved version
    expect(isStandaloneAudioFile(bytes([0xff, 0xf9, 0x90, 0x64]))).toBe(false); // reserved layer
    expect(isStandaloneAudioFile(bytes([0xff, 0xfb, 0x9c, 0x64]))).toBe(false); // reserved sample rate
    expect(isStandaloneAudioFile(bytes([0xff, 0x00, 0x90, 0x64]))).toBe(false); // no frame sync
  });
});
