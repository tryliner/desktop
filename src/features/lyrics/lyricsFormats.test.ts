import { describe, expect, it } from "vitest";
import { parseRawLyrics } from "./engine/lyricsParser";

describe("lyrics format parsing", () => {
  it("parses richsync offsets without doubling", () => {
    const richsync = JSON.stringify([
      {
        ts: 60,
        te: 65,
        l: [
          { c: "Hello ", o: 0.5 },
          { c: "World", o: 2.0 },
        ],
      },
    ]);
    const parsed = parseRawLyrics(richsync, "richsync");
    expect(parsed.syncedLines[0].words?.[0].timeMs).toBe(60500);
    expect(parsed.syncedLines[0].words?.[1].timeMs).toBe(62000);
  });

  it("merges standalone richsync spaces", () => {
    const richsync = JSON.stringify([
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
    const parsed = parseRawLyrics(richsync, "richsync");
    expect(parsed.braccatoLyrics[0].parts?.length).toBe(3);
    expect(parsed.braccatoLyrics[0].words).toBe("Hello world");
  });

  it("parses TTML lyrics", () => {
    const ttml = `<?xml version="1.0" encoding="utf-8"?><tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="00:01.000" end="00:03.000"><span begin="00:01.000" end="00:02.000">Hello </span><span begin="00:02.000" end="00:03.000">world</span></p></div></body></tt>`;
    const parsed = parseRawLyrics(ttml, "ttml");
    expect(parsed.braccatoLyrics[0].startTimeMs).toBe(1000);
  });

  it("parses QRC lyrics", () => {
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
  });

  it("parses LRC lyrics", () => {
    const lrc = "[00:01.50]Line 1\n[00:05.00]Line 2";
    const parsed = parseRawLyrics(lrc, "lrc");
    expect(parsed.braccatoLyrics[1].startTimeMs).toBe(5000);
  });
});
