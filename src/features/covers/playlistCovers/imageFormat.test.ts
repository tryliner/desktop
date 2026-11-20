import { describe, it, expect } from "vitest";
import { countGifFrames, isAnimatedImage, isAnimatedWebp } from "./imageFormat";

const bytes = (text: string) => [...text].map((c) => c.charCodeAt(0));

function gif(frames: number, extensionData: number[] = []): Uint8Array {
  const out = [...bytes("GIF89a"), 1, 0, 1, 0, 0x80, 0, 0];
  out.push(...Array.from({ length: 6 }, () => 0));
  for (let i = 0; i < frames; i++) {
    out.push(0x21, 0xf9, 4, 0, 0, 0, 0, 0);
    if (extensionData.length > 0) {
      out.push(0x21, 0xfe, extensionData.length, ...extensionData, 0);
    }
    out.push(0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 0x01, 0);
  }
  out.push(0x3b);
  return new Uint8Array(out);
}

function webp(flags: number): Uint8Array {
  return new Uint8Array([
    ...bytes("RIFF"),
    0,
    0,
    0,
    0,
    ...bytes("WEBPVP8X"),
    10,
    0,
    0,
    0,
    flags,
    0,
    0,
    0,
  ]);
}

describe("image format", () => {
  it("counts gif frames by walking the blocks", () => {
    expect(countGifFrames(gif(1))).toBe(1);
    expect(countGifFrames(gif(3), 5)).toBe(3);
  });

  it("is not fooled by graphic-control bytes inside other blocks", () => {
    const fake = [0x21, 0xf9, 0x04, 0x21, 0xf9, 0x04];
    expect(isAnimatedImage(gif(1, fake))).toBe(false);
  });

  it("spots animated gifs and webps", () => {
    expect(isAnimatedImage(gif(2))).toBe(true);
    expect(isAnimatedWebp(webp(0x02))).toBe(true);
    expect(isAnimatedWebp(webp(0x10))).toBe(false);
    expect(isAnimatedImage(new Uint8Array([0xff, 0xd8, 0xff, 0, 0]))).toBe(
      false,
    );
  });
});
