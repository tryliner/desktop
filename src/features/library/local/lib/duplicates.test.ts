import { describe, expect, it } from "vitest";
import type { LocalTrackRecord } from "@/shared/media/local";
import { findDuplicateGroups } from "./duplicates";

function record(
  id: string,
  title: string,
  artist: string,
  durationMs: number,
): LocalTrackRecord {
  return {
    id,
    title,
    artist,
    durationMs,
    fileName: `${id}.mp3`,
    audioFile: `${id}.mp3`,
    mimeType: "audio/mpeg",
    byteSize: 1,
    addedAt: 0,
  };
}

describe("findDuplicateGroups", () => {
  it("keeps the newest copy and ignores different durations", () => {
    const groups = findDuplicateGroups([
      record("new", "  Song  Name ", "Artist", 200_000),
      record("old", "song name", " ARTIST ", 203_000),
      record("other", "Song Name", "Artist", 260_000),
      record("single", "Another", "Artist", 100_000),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].keep.id).toBe("new");
    expect(groups[0].remove.map((item) => item.id)).toEqual(["old"]);
  });

  it("does not treat zero or unknown durations as duplicate matches", () => {
    const groups = findDuplicateGroups([
      record("known", "Song Name", "Artist", 200_000),
      record("unknown", "Song Name", "Artist", 0),
    ]);

    expect(groups).toHaveLength(0);
  });
});
