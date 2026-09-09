import { describe, expect, it, beforeEach } from "vitest";
import { applyLyricsOffset, parseRawLyrics } from "./engine/lyricsParser";
import { useLyricsStore } from "./store/lyricsStore";
import type { Lyric } from "@braccato/parsers";

describe("applyLyricsOffset", () => {
  const sampleBraccatoLyrics: Lyric[] = [
    {
      startTimeMs: 1000,
      durationMs: 2000,
      words: "Hello world",
      parts: [
        { startTimeMs: 1000, durationMs: 900, words: "Hello " },
        { startTimeMs: 1900, durationMs: 1100, words: "world" },
      ],
    },
    {
      startTimeMs: 3500,
      durationMs: 1500,
      words: "Second line",
    },
  ];

  const sampleSyncedLines = [
    {
      timeMs: 1000,
      text: "Hello world",
      words: [
        { timeMs: 1000, endMs: 1900, text: "Hello " },
        { timeMs: 1900, endMs: 3000, text: "world" },
      ],
    },
    {
      timeMs: 3500,
      text: "Second line",
    },
  ];

  it("returns original when offset is 0", () => {
    const res = applyLyricsOffset(
      { braccatoLyrics: sampleBraccatoLyrics, syncedLines: sampleSyncedLines },
      0,
    );
    expect(res.braccatoLyrics[0].startTimeMs).toBe(1000);
    expect(res.syncedLines[0].timeMs).toBe(1000);
  });

  it("applies positive offset (delaying lyrics)", () => {
    const res = applyLyricsOffset(
      { braccatoLyrics: sampleBraccatoLyrics, syncedLines: sampleSyncedLines },
      500,
    );

    expect(res.braccatoLyrics[0].startTimeMs).toBe(1500);
    expect(res.braccatoLyrics[0].parts?.[0].startTimeMs).toBe(1500);
    expect(res.braccatoLyrics[0].parts?.[1].startTimeMs).toBe(2400);
    expect(res.braccatoLyrics[1].startTimeMs).toBe(4000);

    expect(res.syncedLines[0].timeMs).toBe(1500);
    expect(res.syncedLines[0].words?.[0].timeMs).toBe(1500);
    expect(res.syncedLines[0].words?.[0].endMs).toBe(2400);
    expect(res.syncedLines[1].timeMs).toBe(4000);
  });

  it("applies negative offset (advancing lyrics)", () => {
    const res = applyLyricsOffset(
      { braccatoLyrics: sampleBraccatoLyrics, syncedLines: sampleSyncedLines },
      -300,
    );

    expect(res.braccatoLyrics[0].startTimeMs).toBe(700);
    expect(res.braccatoLyrics[0].parts?.[0].startTimeMs).toBe(700);
    expect(res.braccatoLyrics[0].parts?.[1].startTimeMs).toBe(1600);
    expect(res.braccatoLyrics[1].startTimeMs).toBe(3200);

    expect(res.syncedLines[0].timeMs).toBe(700);
    expect(res.syncedLines[0].words?.[0].timeMs).toBe(700);
    expect(res.syncedLines[0].words?.[0].endMs).toBe(1600);
    expect(res.syncedLines[0].words?.[1].timeMs).toBe(1600);
    expect(res.syncedLines[0].words?.[1].endMs).toBe(2700);
  });

  it("clamps negative offset so timestamps never drop below 0", () => {
    const res = applyLyricsOffset(
      { braccatoLyrics: sampleBraccatoLyrics, syncedLines: sampleSyncedLines },
      -2000,
    );

    expect(res.braccatoLyrics[0].startTimeMs).toBe(0);
    expect(res.braccatoLyrics[0].parts?.[0].startTimeMs).toBe(0);
    expect(res.syncedLines[0].timeMs).toBe(0);
    expect(res.syncedLines[0].words?.[0].timeMs).toBe(0);
  });
});

describe("useLyricsStore offset handling", () => {
  beforeEach(() => {
    useLyricsStore.getState().reset();
  });

  it("sets and adjusts offset", () => {
    const store = useLyricsStore.getState();

    store.setLyricsState({
      currentLyricsTrackId: "track-1",
      braccatoLyrics: [
        { startTimeMs: 2000, durationMs: 1000, words: "Line 1" },
      ],
      syncedLines: [{ timeMs: 2000, text: "Line 1" }],
    });

    expect(useLyricsStore.getState().offsetMs).toBe(0);
    expect(useLyricsStore.getState().braccatoLyrics[0].startTimeMs).toBe(2000);

    useLyricsStore.getState().setOffset(500);
    expect(useLyricsStore.getState().offsetMs).toBe(500);
    expect(useLyricsStore.getState().braccatoLyrics[0].startTimeMs).toBe(2500);
    expect(useLyricsStore.getState().syncedLines[0].timeMs).toBe(2500);

    useLyricsStore.getState().adjustOffset(-200);
    expect(useLyricsStore.getState().offsetMs).toBe(300);
    expect(useLyricsStore.getState().braccatoLyrics[0].startTimeMs).toBe(2300);

    useLyricsStore.getState().resetOffset();
    expect(useLyricsStore.getState().offsetMs).toBe(0);
    expect(useLyricsStore.getState().braccatoLyrics[0].startTimeMs).toBe(2000);
  });

  it("remembers offset per track in trackOffsets", () => {
    useLyricsStore.getState().setLyricsState({
      currentLyricsTrackId: "track-a",
      braccatoLyrics: [{ startTimeMs: 1000, durationMs: 1000, words: "A" }],
      syncedLines: [{ timeMs: 1000, text: "A" }],
    });

    useLyricsStore.getState().setOffset(400);
    expect(useLyricsStore.getState().trackOffsets["track-a"]).toBe(400);

    // Switch to track-b
    useLyricsStore.getState().setLyricsState({
      currentLyricsTrackId: "track-b",
      braccatoLyrics: [{ startTimeMs: 1000, durationMs: 1000, words: "B" }],
      syncedLines: [{ timeMs: 1000, text: "B" }],
    });

    expect(useLyricsStore.getState().offsetMs).toBe(0);
    expect(useLyricsStore.getState().braccatoLyrics[0].startTimeMs).toBe(1000);

    // Switch back to track-a
    useLyricsStore.getState().setLyricsState({
      currentLyricsTrackId: "track-a",
      braccatoLyrics: [{ startTimeMs: 1000, durationMs: 1000, words: "A" }],
      syncedLines: [{ timeMs: 1000, text: "A" }],
    });

    expect(useLyricsStore.getState().offsetMs).toBe(400);
    expect(useLyricsStore.getState().braccatoLyrics[0].startTimeMs).toBe(1400);
  });

  it("correctly parses richsync with relative and absolute offsets without time doubling", () => {
    const richsyncRelative = JSON.stringify([
      {
        ts: 60,
        te: 65,
        l: [
          { c: "Hello ", o: 0.5 },
          { c: "World", o: 2.0 },
        ],
      },
    ]);

    const parsedRel = parseRawLyrics(richsyncRelative, "richsync");
    expect(parsedRel.syncedLines[0].words?.[0].timeMs).toBe(60500);
    expect(parsedRel.syncedLines[0].words?.[1].timeMs).toBe(62000);

    const richsyncAbsolute = JSON.stringify([
      {
        ts: 60,
        te: 65,
        l: [
          { c: "Hello ", o: 60.5 },
          { c: "World", o: 62.0 },
        ],
      },
    ]);

    const parsedAbs = parseRawLyrics(richsyncAbsolute, "richsync");
    expect(parsedAbs.syncedLines[0].words?.[0].timeMs).toBe(60500);
    expect(parsedAbs.syncedLines[0].words?.[1].timeMs).toBe(62000);
  });

  it("merges standalone space tokens into preceding words in richsync while keeping syllables contiguous", () => {
    const richsyncWithSeparateSpaces = JSON.stringify([
      {
        ts: 10,
        te: 15,
        l: [
          { c: "Hel", o: 0.1 },
          { c: "lo", o: 0.3 },
          { c: " ", o: 0.5 },
          { c: "world", o: 0.7 },
        ],
      },
    ]);

    const parsed = parseRawLyrics(richsyncWithSeparateSpaces, "richsync");
    expect(parsed.braccatoLyrics[0].parts?.length).toBe(3);
    expect(parsed.braccatoLyrics[0].parts?.[0].words).toBe("Hel");
    expect(parsed.braccatoLyrics[0].parts?.[1].words).toBe("lo ");
    expect(parsed.braccatoLyrics[0].parts?.[2].words).toBe("world");
    expect(parsed.braccatoLyrics[0].words).toBe("Hello world");
  });

  it("parses TTML lyrics directly with braccato parser", () => {
    const ttml = `<?xml version="1.0" encoding="utf-8"?><tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="00:01.000" end="00:03.000"><span begin="00:01.000" end="00:02.000">Hello </span><span begin="00:02.000" end="00:03.000">world</span></p></div></body></tt>`;

    const parsed = parseRawLyrics(ttml, "ttml");
    expect(parsed.braccatoLyrics.length).toBe(1);
    expect(parsed.braccatoLyrics[0].startTimeMs).toBe(1000);
    expect(parsed.syncedLines.length).toBe(1);
    expect(parsed.syncedLines[0].words?.length).toBe(2);
    expect(parsed.syncedLines[0].words?.[0].timeMs).toBe(1000);
  });

  it("parses QRC lyrics directly with braccato parser", () => {
    const qrc = `<?xml version="1.0" encoding="utf-8"?>
<QrcInfos>
  <QrcInfo>
    <LyricInfo>
      <LyricContent="[0,2000](0,1000)Hello (1000,1000)world\n[2000,2000](2000,2000)Second line"/>
    </LyricInfo>
  </QrcInfo>
</QrcInfos>`;

    const parsed = parseRawLyrics(qrc, "qrc");
    expect(parsed.braccatoLyrics.length).toBe(2);
    expect(parsed.braccatoLyrics[0].startTimeMs).toBe(0);
    expect(parsed.syncedLines[0].words?.length).toBe(2);
  });

  it("parses LRC lyrics directly with braccato parser", () => {
    const lrc = `[00:01.50]Line 1
[00:05.00]Line 2`;

    const parsed = parseRawLyrics(lrc, "lrc");
    expect(parsed.braccatoLyrics.length).toBe(2);
    expect(parsed.braccatoLyrics[0].startTimeMs).toBe(1500);
    expect(parsed.braccatoLyrics[1].startTimeMs).toBe(5000);
  });
});
