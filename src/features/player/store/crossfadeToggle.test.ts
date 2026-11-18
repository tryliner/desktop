import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION_KEY = "liner_player_session_v2";

async function loadStore() {
  vi.resetModules();
  const mod = await import("./playerStore");
  return mod.usePlayerStore;
}

describe("crossfade on/off", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is off by default and turns on at the default length", async () => {
    const store = await loadStore();
    expect(store.getState().crossfadeSeconds).toBe(0);
    store.getState().setCrossfadeEnabled(true);
    expect(store.getState().crossfadeSeconds).toBe(6);
  });

  it("remembers the picked length while switched off", async () => {
    const store = await loadStore();
    store.getState().setCrossfadeSeconds(9);
    expect(store.getState().crossfadeSeconds).toBe(9);
    store.getState().setCrossfadeEnabled(false);
    expect(store.getState().crossfadeSeconds).toBe(0);
    expect(store.getState().crossfadeLength).toBe(9);
    store.getState().setCrossfadeEnabled(true);
    expect(store.getState().crossfadeSeconds).toBe(9);
  });

  it("treats 0 as off without losing the length", async () => {
    const store = await loadStore();
    store.getState().setCrossfadeSeconds(4);
    store.getState().setCrossfadeSeconds(0);
    expect(store.getState().crossfadeSeconds).toBe(0);
    expect(store.getState().crossfadeLength).toBe(4);
  });

  it("clamps lengths to 12 seconds", async () => {
    const store = await loadStore();
    store.getState().setCrossfadeSeconds(40);
    expect(store.getState().crossfadeSeconds).toBe(12);
    expect(store.getState().crossfadeLength).toBe(12);
  });

  it("carries an older build's crossfade over as the remembered length", async () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ state: { crossfadeSeconds: 8 } }),
    );
    const store = await loadStore();
    await store.persist.rehydrate();
    expect(store.getState().crossfadeSeconds).toBe(8);
    expect(store.getState().crossfadeLength).toBe(8);
    store.getState().setCrossfadeEnabled(false);
    store.getState().setCrossfadeEnabled(true);
    expect(store.getState().crossfadeSeconds).toBe(8);
  });
});
