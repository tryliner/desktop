import { describe, expect, it } from "vitest";
import { playlistIdFromYoutube, videoIdFromYoutube } from "./youtubeUrl";

describe("youtube url helpers", () => {
  it("extracts playlist and video identifiers", () => {
    expect(
      playlistIdFromYoutube("https://music.youtube.com/playlist?list=PLabc"),
    ).toBe("VLPLabc");
    expect(
      playlistIdFromYoutube(
        "https://music.youtube.com/browse/VLPLabc?list=VLPLabc",
      ),
    ).toBe("VLPLabc");
    expect(
      playlistIdFromYoutube("https://youtu.be/dQw4w9WgXcQ"),
    ).toBeUndefined();
    expect(videoIdFromYoutube("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(
      videoIdFromYoutube("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
    expect(
      videoIdFromYoutube("https://www.youtube.com/embed/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
    expect(videoIdFromYoutube("https://www.youtube.com/")).toBeUndefined();
  });
});
