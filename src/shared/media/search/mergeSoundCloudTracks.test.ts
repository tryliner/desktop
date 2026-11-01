import { describe, expect, it } from "vitest";
import type { SearchResult } from "@/shared/contracts";
import type { SoundCloudSearchHit } from "@/shared/media/soundcloud";
import { mergeSoundCloudTracks } from "./mergeSoundCloudTracks";

type TrackResult = Extract<SearchResult, { type: "track" }>;

function hit(
  id: string,
  title: string,
  artist: string,
  durationMs: number,
): TrackResult {
  return {
    type: "track",
    id,
    title,
    artists: [{ id: `${id}-artist`, name: artist }],
    durationMs,
  };
}

function upload(
  id: string,
  title: string,
  uploader: string,
  durationMs: number,
  extra: Partial<SoundCloudSearchHit> = {},
): SoundCloudSearchHit {
  return {
    track: hit(id, title, uploader, durationMs),
    uploader,
    plays: 0,
    ...extra,
  };
}

const ids = (items: SearchResult[]) => items.map((item) => item.id);

describe("mergeSoundCloudTracks", () => {
  it("hides a soundcloud upload that youtube already has", () => {
    const youtube = [
      hit("yt1", "Delilah (pull me out of this)", "Fred again..", 253_000),
    ];
    const soundcloud = [
      upload("sc:1", "Delilah (pull me out of this)", "Fred again..", 253_400),
    ];
    expect(
      ids(mergeSoundCloudTracks("fred again delilah", youtube, soundcloud)),
    ).toEqual(["yt1"]);
  });

  it("hides the soundcloud original when youtube only has an artistless reupload", () => {
    const youtube = [hit("yt1", "Midnight Glass", "Music Archive", 201_000)];
    const soundcloud = [upload("sc:1", "Midnight Glass", "nuvole", 201_800)];
    expect(
      ids(mergeSoundCloudTracks("midnight glass", youtube, soundcloud)),
    ).toEqual(["yt1"]);
  });

  it("matches a youtube reupload that names the artist in the title", () => {
    const youtube = [
      hit(
        "yt1",
        "nuvole - Midnight Glass [FREE DL]",
        "Reupload Channel",
        207_000,
      ),
    ];
    const soundcloud = [upload("sc:1", "Midnight Glass", "nuvole", 201_000)];
    expect(
      ids(mergeSoundCloudTracks("midnight glass", youtube, soundcloud)),
    ).toEqual(["yt1"]);
  });

  it("keeps soundcloud versions youtube does not have", () => {
    const youtube = [
      hit("yt1", "Delilah (pull me out of this)", "Fred again..", 253_000),
    ];
    const soundcloud = [
      upload(
        "sc:2",
        "Fred again.. - Delilah (Rimon Bootleg)",
        "Rimon",
        290_000,
      ),
    ];
    expect(
      ids(mergeSoundCloudTracks("fred again delilah", youtube, soundcloud)),
    ).toEqual(["yt1", "sc:2"]);
  });

  it("keeps a same-title song by another artist with a different length", () => {
    const youtube = [hit("yt1", "Midnight Glass", "Aurora Lane", 180_000)];
    const soundcloud = [upload("sc:1", "Midnight Glass", "nuvole", 201_000)];
    expect(
      ids(mergeSoundCloudTracks("midnight glass", youtube, soundcloud)),
    ).toContain("sc:1");
  });

  it("collapses soundcloud reuploads of a track missing on youtube", () => {
    const soundcloud = [
      upload("sc:1", "Night Drive", "kaiwa", 180_000),
      upload("sc:2", "kaiwa - Night Drive (free dl)", "reposts daily", 180_500),
    ];
    expect(
      ids(mergeSoundCloudTracks("kaiwa night drive", [], soundcloud)),
    ).toEqual(["sc:1"]);
  });

  it("puts an exact soundcloud hit above loosely related youtube results", () => {
    const youtube = [
      hit("yt1", "Night Drive", "kaiwa", 180_000),
      hit("yt2", "Late Night Drive Mix 2024", "Chill Radio", 3_600_000),
    ];
    const soundcloud = [
      upload("sc:9", "Night Drive (Gesaffelstein Remix)", "kaiwa", 240_000),
    ];
    expect(
      ids(mergeSoundCloudTracks("kaiwa night drive", youtube, soundcloud)),
    ).toEqual(["yt1", "sc:9", "yt2"]);
  });

  it("drops soundcloud hits unrelated to the query", () => {
    const soundcloud = [
      upload("sc:3", "Something Else Entirely", "dj nobody", 200_000),
    ];
    expect(
      ids(mergeSoundCloudTracks("kaiwa night drive", [], soundcloud)),
    ).toEqual([]);
  });

  it("keeps non-track results in place for mixed search", () => {
    const primary: SearchResult[] = [
      { type: "artist", id: "artist1", name: "kaiwa" },
      hit("yt1", "Night Drive", "kaiwa", 180_000),
      { type: "album", id: "album1", title: "Drives", artists: [] },
    ];
    const soundcloud = [
      upload("sc:9", "Night Drive (Gesaffelstein Remix)", "kaiwa", 240_000),
    ];
    expect(
      ids(mergeSoundCloudTracks("kaiwa night drive", primary, soundcloud)),
    ).toEqual(["artist1", "yt1", "sc:9", "album1"]);
  });

  it("prefers the artist's own upload over a reupload soundcloud ranks first", () => {
    const soundcloud = [
      upload("sc:2408742810", "zombiqe — bye, bay!<3", "leanoman", 93_704, {
        publisherArtist: "yahisoo",
        plays: 7_533,
      }),
      upload("sc:2424339549", "bye, bay!<3", "zombiqe #delsagate", 99_786, {
        publisherArtist: "zombiqe #delsagate",
        plays: 35_109,
      }),
      upload("sc:2409425388", "bye, bay!3", "xxx", 93_762, {
        publisherArtist: "zombiqe #delsagate",
        plays: 1_560,
      }),
    ];
    const merged = ids(mergeSoundCloudTracks("bye bay", [], soundcloud));
    expect(merged[0]).toBe("sc:2424339549");
  });
});
