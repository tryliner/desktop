import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectParser, type Lyric } from "@braccato/parsers";
import { buildLines } from "./buildLines";
import { LyricsCanvasRenderer } from "./lyricsCanvasRenderer";

const PLAIN = Array.from(
  { length: 30 },
  (_, index) => `plain line number ${index + 1}`,
).join("\n");

const LRC = Array.from({ length: 30 }, (_, index) => {
  const seconds = 5 + index * 4;
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `[${mm}:${ss}.00]synced line number ${index + 1}`;
}).join("\n");

function parse(raw: string): Lyric[] {
  return detectParser(raw).parse(raw);
}

function fakeContext(): CanvasRenderingContext2D {
  const metrics = {
    width: 0,
    fontBoundingBoxAscent: 30,
    fontBoundingBoxDescent: 8,
  };
  const gradient = { addColorStop: () => {} };
  return new Proxy({} as Record<string, unknown>, {
    get(target, key) {
      if (key in target) return target[key as string];
      if (key === "measureText")
        return (text: string) => ({ ...metrics, width: text.length * 16 });
      if (key === "createLinearGradient") return () => gradient;
      return () => {};
    },
    set(target, key, value) {
      target[key as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

function mountRenderer(timeMs: number) {
  const renderer = new LyricsCanvasRenderer(
    document.createElement("canvas"),
    document.createElement("canvas"),
    { timeMs: () => timeMs, playing: () => true },
    () => {},
  );
  renderer.resize(600, 400, 1);
  return renderer;
}

function scrollOf(renderer: LyricsCanvasRenderer): number {
  return (renderer as unknown as { motion: { position: number } }).motion
    .position;
}

describe("untimed lyrics", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => fakeContext() as never,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks plain text as untimed and lrc as timed", () => {
    expect(buildLines(parse(PLAIN)).timed).toBe(false);
    expect(buildLines(parse(LRC)).timed).toBe(true);
  });

  it("opens plain text at the top instead of the last line", () => {
    const renderer = mountRenderer(1_500);
    renderer.setLyrics(parse(PLAIN));
    expect(scrollOf(renderer)).toBe(0);
    renderer.follow();
    renderer.resize(600, 380, 1);
    expect(scrollOf(renderer)).toBe(0);
    renderer.dispose();
  });

  it("does not seek when a plain line is clicked", () => {
    const renderer = mountRenderer(1_500);
    renderer.setLyrics(parse(PLAIN));
    expect(renderer.lineStartAt(60)).toBeNull();
    renderer.dispose();
  });

  it("starts plain text at the top after a synced track scrolled down", () => {
    const renderer = mountRenderer(100_000);
    renderer.setLyrics(parse(LRC));
    expect(scrollOf(renderer)).toBeGreaterThan(0);
    renderer.setLyrics(parse(PLAIN));
    expect(scrollOf(renderer)).toBe(0);
    renderer.dispose();
  });

  it("keeps following synced lyrics", () => {
    const renderer = mountRenderer(100_000);
    renderer.setLyrics(parse(LRC));
    expect(scrollOf(renderer)).toBeGreaterThan(0);
    expect(renderer.lineStartAt(60)).not.toBeNull();
    renderer.dispose();
  });
});
