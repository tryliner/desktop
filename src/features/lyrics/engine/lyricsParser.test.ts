import { describe, expect, it } from "vitest";
import { parseRawLyrics } from "./lyricsParser";

const plainTtml = `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xml:lang="en">
  <head><metadata><translations><p>Translated line</p></translations></metadata></head>
  <body>
    <div>
      <p>Parallelograms</p>
      <p>Parallelograms</p>
      <p></p>
      <p>Rhomboids, <span>cylinders</span> &amp; spheres</p>
      <p>Line one<br/>Line two</p>
    </div>
  </body>
</tt>`;

const syncedTtml = `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xml:lang="en">
  <body>
    <div>
      <p begin="00:01.000" end="00:03.500">First line</p>
      <p begin="00:04.000" end="00:06.000">Second line</p>
    </div>
  </body>
</tt>`;

describe("parseRawLyrics ttml", () => {
  it("returns untimed lines for plain ttml without timing", () => {
    const parsed = parseRawLyrics(plainTtml, "ttml");

    expect(parsed.braccatoLyrics.map((line) => line.words)).toEqual([
      "Parallelograms",
      "Parallelograms",
      "Rhomboids, cylinders & spheres",
      "Line one",
      "Line two",
    ]);
    expect(
      parsed.braccatoLyrics.every(
        (line) => line.startTimeMs === 0 && line.durationMs === 0,
      ),
    ).toBe(true);
    expect(parsed.syncedLines).toHaveLength(5);
    expect(parsed.plainLyrics).toBe(
      "Parallelograms\nParallelograms\nRhomboids, cylinders & spheres\nLine one\nLine two",
    );
  });

  it("keeps timing for synced ttml", () => {
    const parsed = parseRawLyrics(syncedTtml, "ttml");

    expect(
      parsed.braccatoLyrics.map((line) => ({
        words: line.words,
        startTimeMs: line.startTimeMs,
        durationMs: line.durationMs,
      })),
    ).toEqual([
      { words: "First line", startTimeMs: 1000, durationMs: 2500 },
      { words: "Second line", startTimeMs: 4000, durationMs: 2000 },
    ]);
  });
});
