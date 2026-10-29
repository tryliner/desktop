import { beforeAll, describe, expect, it } from "vitest";
import { loadRomanizers } from "./engine/lyricsRomanization";
import { syncRomanization } from "./engine/lyricsRomanizationDom";
import { fakeView, lyric } from "./testing/romanizationView";

beforeAll(() => loadRomanizers([lyric("我爱你")]));

describe("reading updates", () => {
  it("removes a stale Mandarin reading when Japanese has not been prepared", () => {
    const song = [lyric("未来")];
    const { el } = fakeView(song);
    syncRomanization(el, song, true, "zh");
    expect(el.querySelector(".blyrics--romanized")).not.toBeNull();
    syncRomanization(el, song, true, "ja");
    expect(el.querySelector(".blyrics--romanized")).toBeNull();
  });

  it("restores provider readings after toggling and hides them for Skip", () => {
    const song = [{ ...lyric("宇宙"), romanization: "sora" }];
    const { el, scheduleLyricPositionUpdate } = fakeView(song);
    syncRomanization(el, song, true);
    syncRomanization(el, song, false);
    syncRomanization(el, song, true);
    expect(el.querySelectorAll(".blyrics--romanized")).toHaveLength(1);
    expect(el.querySelector(".blyrics--romanized")?.textContent).toBe("sora");
    const count = scheduleLyricPositionUpdate.mock.calls.length;
    syncRomanization(el, song, true);
    expect(scheduleLyricPositionUpdate).toHaveBeenCalledTimes(count);
    syncRomanization(el, song, true, "off");
    expect(el.querySelector(".blyrics--romanized")).toBeNull();
  });
});
