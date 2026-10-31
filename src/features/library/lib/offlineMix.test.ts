import { describe, expect, it } from "vitest";
import type { Track } from "@/shared/types";
import { mergeOfflineTracks } from "./offlineMix";

const track = (id: string) => ({ id, title: id }) as Track;

describe("mergeOfflineTracks", () => {
  it("keeps source order and plays a song saved in two places once", () => {
    const liked = [track("a"), track("b")];
    const cached = [track("b"), track("c")];
    const local = [track("local:1")];
    expect(
      mergeOfflineTracks(liked, cached, local).map((item) => item.id),
    ).toEqual(["a", "b", "c", "local:1"]);
  });

  it("is empty when nothing is available offline", () => {
    expect(mergeOfflineTracks([], [], [])).toEqual([]);
  });
});
