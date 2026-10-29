import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SESSION_KEY = "liner_player_session_v2";

async function restore(saved: Record<string, unknown>) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ state: saved, version: 0 }),
  );
  vi.resetModules();
  const { usePlayerStore } = await import("./playerStore");
  return usePlayerStore.getState();
}

describe("shuffle mode in a saved session", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("keeps shuffle on for sessions saved before shuffle modes existed", async () => {
    const state = await restore({ shuffle: true });
    expect(state.shuffleMode).toBe("playlist");
    expect(state.shuffle).toBe(true);
  });

  it("keeps shuffle off for old sessions that had it off", async () => {
    const state = await restore({ shuffle: false });
    expect(state.shuffleMode).toBe("off");
    expect(state.shuffle).toBe(false);
  });

  it("restores a saved smart shuffle mode", async () => {
    const state = await restore({ shuffle: true, shuffleMode: "smart" });
    expect(state.shuffleMode).toBe("smart");
    expect(state.shuffle).toBe(true);
  });

  it("falls back to the old flag when the saved mode is unknown", async () => {
    const state = await restore({ shuffle: true, shuffleMode: "random" });
    expect(state.shuffleMode).toBe("playlist");
  });
});
