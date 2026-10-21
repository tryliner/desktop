import { describe, it, expect } from "vitest";
import {
  parseSpotifyCsv,
  scoreMatch,
  isConfidentMatch,
  looksLikeStub,
  artistNamesOf,
} from "./spotifyCsv";

const CSV_HEADER =
  "Track URI,Track Name,Album Name,Artist Name(s),Duration (ms),Added At\n";

function row(title: string, artist: string, durationMs = 200000) {
  return `spotify:track:x,${title},Album,${artist},${durationMs},2026-01-01\n`;
}

describe("parseSpotifyCsv", () => {
  it("reads title, artist and duration from an exportify export", () => {
    const rows = parseSpotifyCsv(CSV_HEADER + row("Space Song", "Beach House"));
    expect(rows).toEqual([{ title: "Space Song", artist: "Beach House", durationMs: 200000 }]);
  });

  it("handles quoted fields with commas and escaped quotes", () => {
    const csv = `${CSV_HEADER}"spotify:track:x","Tombé pour elle (feat. Amel Bent)","Album","La Fouine;Amel Bent",278640,2026-01-01\n`;
    const rows = parseSpotifyCsv(csv);
    expect(rows[0].title).toBe("Tombé pour elle (feat. Amel Bent)");
    expect(rows[0].artist).toBe("La Fouine;Amel Bent");
    expect(rows[0].durationMs).toBe(278640);
  });

  it("skips rows without a track name and returns empty for foreign csvs", () => {
    const withBlank = parseSpotifyCsv(CSV_HEADER + row("Real One", "Artist") + ',,"Album","Artist",0,2026-01-01\n');
    expect(withBlank).toHaveLength(1);

    expect(parseSpotifyCsv("a,b,c\n1,2,3\n")).toEqual([]);
    expect(parseSpotifyCsv("")).toEqual([]);
  });

  it("accepts crlf line endings", () => {
    const rows = parseSpotifyCsv(
      CSV_HEADER.replace(/\n/g, "\r\n") + row("Space Song", "Beach House").replace(/\n/g, "\r\n"),
    );
    expect(rows).toHaveLength(1);
  });
});

describe("match scoring", () => {
  it("scores an exact title and artist as a confident match", () => {
    const row = { title: "Space Song", artist: "Beach House", durationMs: 320000 };
    const candidate = {
      id: "1",
      title: "Space Song",
      artists: [{ id: "a", name: "Beach House" }],
      durationMs: 320400,
    };
    const score = scoreMatch(row, candidate);
    expect(score.title).toBe(1);
    expect(score.artist).toBe(1);
    expect(isConfidentMatch(score, true)).toBe(true);
  });

  it("ignores version suffixes that only appear on one side", () => {
    const row = { title: "Do I Wanna Know?", artist: "Arctic Monkeys" };
    const candidate = {
      id: "1",
      title: "Do I Wanna Know? - Remastered 2013",
      artists: "Arctic Monkeys",
    };
    const score = scoreMatch(row, candidate);
    expect(score.title).toBe(1);
  });

  it("rejects a matching title with a different artist", () => {
    const row = { title: "Space Song", artist: "Beach House" };
    const candidate = { id: "1", title: "Space Song", artists: "Cover Band" };
    expect(isConfidentMatch(scoreMatch(row, candidate), true)).toBe(false);
  });

  it("flags catalog stubs so they can never match", () => {
    expect(
      looksLikeStub({ id: "1", title: "Unknown Title", artists: "Unknown Artist" }),
    ).toBe(true);
    expect(looksLikeStub({ id: "1", title: "", artists: "" })).toBe(true);
    expect(looksLikeStub({ id: "1", title: "Space Song", artists: "Beach House" })).toBe(false);
  });

  it("does not treat real songs containing 'unknown' as stubs", () => {
    expect(looksLikeStub({ id: "1", title: "Into the Unknown", artists: "Aurora" })).toBe(false);
    expect(
      looksLikeStub({ id: "1", title: "Needed", artists: "Unknown Mortal Orchestra" }),
    ).toBe(false);
  });

  it("requires tokens to match as whole words", () => {
    const row = { title: "Run", artist: "Collective Member" };
    const candidate = {
      id: "1",
      title: "Running Up That Hill",
      artists: "Collective Member",
    };
    expect(scoreMatch(row, candidate).title).toBe(0);
  });

  it("matches titles that consist only of a year or filler word", () => {
    const row = { title: "1999", artist: "Prince" };
    const candidate = { id: "1", title: "1999", artists: "Prince" };
    expect(isConfidentMatch(scoreMatch(row, candidate), true)).toBe(true);
  });

  it("scores non-latin titles instead of dropping them", () => {
    const row = { title: "Потеряла голову", artist: "HANNA" };
    const candidate = { id: "1", title: "Потеряла голову", artists: "HANNA" };
    const score = scoreMatch(row, candidate);
    expect(score.title).toBe(1);
    expect(isConfidentMatch(score, true)).toBe(true);
  });

  it("joins artist names from either shape the api returns", () => {
    expect(artistNamesOf({ id: "1", title: "x", artists: "Solo" })).toBe("Solo");
    expect(
      artistNamesOf({ id: "1", title: "x", artists: [{ id: "a", name: "One" }, { id: "b", name: "Two" }] }),
    ).toBe("One Two");
  });
});
