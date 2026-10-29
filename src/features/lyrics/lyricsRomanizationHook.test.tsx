import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lyric } from "@braccato/parsers";
import {
  useLyricsRomanization,
  type RomanizationHost,
} from "./hooks/useLyricsRomanization";
import { useLyricsDisplayStore } from "./store/lyricsDisplayStore";
import { useLyricsStore } from "./store/lyricsStore";
import { useRomanizationRuntimeStore as runtime } from "./store/romanizationRuntimeStore";
import { deferred, fakeView, lyric } from "./testing/romanizationView";

const load = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("./engine/lyricsRomanization", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./engine/lyricsRomanization")>()),
  loadRomanizers: load,
}));

let root: Root;
let container: HTMLElement;
const reference: { current: (HTMLElement & RomanizationHost) | null } = {
  current: null,
};
function Harness({ lyrics }: { lyrics: Lyric[] }) {
  useLyricsRomanization(reference, lyrics);
  return null;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  load.mockReset().mockResolvedValue(undefined);
  useLyricsDisplayStore.setState({ romanization: true, languageOverrides: {} });
  useLyricsStore.getState().reset();
  runtime.setState({ key: "", status: "idle", retryToken: 0 });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("asynchronous romanization lifecycle", () => {
  it("keeps available readings on failure and recovers on retry", async () => {
    const song = [lyric("사랑해")];
    const view = fakeView(song);
    reference.current = view.el;
    load.mockRejectedValueOnce(new Error("dictionary unavailable"));
    await act(async () => root.render(<Harness lyrics={song} />));
    expect(runtime.getState().status).toBe("error");
    expect(view.el.querySelector(".blyrics--romanized")?.textContent).toBe(
      "saranghae",
    );
    await act(async () => runtime.getState().retry());
    expect(load).toHaveBeenCalledTimes(2);
    expect(runtime.getState().status).toBe("ready");
  });

  it("does not inject late results after the toggle is disabled", async () => {
    const pending = deferred();
    load.mockReturnValueOnce(pending.promise);
    const song = [lyric("사랑해")];
    const view = fakeView(song);
    reference.current = view.el;
    await act(async () => root.render(<Harness lyrics={song} />));
    expect(runtime.getState().status).toBe("loading");
    await act(async () =>
      useLyricsDisplayStore.getState().setRomanization(false),
    );
    await act(async () => pending.resolve());
    expect(view.el.querySelector(".blyrics--romanized")).toBeNull();
    expect(runtime.getState().status).toBe("idle");
  });

  it("does not carry an old track's failure into the next track", async () => {
    const pending = deferred();
    load.mockReturnValueOnce(pending.promise);
    const first = [lyric("사랑해")];
    reference.current = fakeView(first).el;
    await act(async () => root.render(<Harness lyrics={first} />));
    const second = [lyric("너")];
    const next = fakeView(second);
    reference.current = next.el;
    await act(async () => root.render(<Harness lyrics={second} />));
    expect(runtime.getState().status).toBe("ready");
    const currentKey = runtime.getState().key;
    await act(async () => pending.reject(new Error("old worker failed")));
    expect(runtime.getState().key).toBe(currentKey);
    expect(runtime.getState().status).toBe("ready");
    expect(next.el.querySelector(".blyrics--romanized")?.textContent).toBe(
      "neo",
    );
  });
});
