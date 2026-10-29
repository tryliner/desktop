import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JapaneseRequest, JapaneseResponse } from "./engine/japaneseTypes";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<JapaneseResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn<(message: JapaneseRequest) => void>();
  terminate = vi.fn();

  constructor() {
    FakeWorker.instances.push(this);
  }

  reply(results: string[]) {
    const { id } = this.postMessage.mock.calls.at(-1)![0];
    this.onmessage?.(new MessageEvent("message", { data: { id, results } }));
  }
}

beforeEach(() => {
  vi.resetModules();
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("lazy Japanese worker", () => {
  it("starts only when needed and coalesces repeated requests", async () => {
    const mod = await import("./engine/japaneseRomanization");
    expect(FakeWorker.instances).toHaveLength(0);
    const first = mod.prepareJapaneseLyrics(["君", "君"]);
    const second = mod.prepareJapaneseLyrics(["君"]);
    const worker = FakeWorker.instances[0];
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    expect(worker.postMessage.mock.calls[0][0].dictionaryPath).toBe(
      "/kuromoji-dict/",
    );
    worker.reply(["kimi"]);
    await Promise.all([first, second]);
    expect(mod.readJapaneseRomanization(" 君 ")).toBe("kimi");
    await mod.prepareJapaneseLyrics(["君"]);
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
  });

  it("recovers from a worker failure on the next attempt", async () => {
    const mod = await import("./engine/japaneseRomanization");
    const failed = mod.prepareJapaneseLyrics(["君"]);
    const rejected = expect(failed).rejects.toThrow("failed to load");
    FakeWorker.instances[0].onerror?.();
    await rejected;
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
    const retried = mod.prepareJapaneseLyrics(["君"]);
    FakeWorker.instances[1].reply(["kimi"]);
    await retried;
    expect(mod.readJapaneseRomanization("君")).toBe("kimi");
  });

  it("times out and permits a fresh worker instead of hanging", async () => {
    vi.useFakeTimers();
    const mod = await import("./engine/japaneseRomanization");
    const failed = mod.prepareJapaneseLyrics(["君"]);
    const rejected = expect(failed).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(60_000);
    await rejected;
    const retried = mod.prepareJapaneseLyrics(["君"]);
    FakeWorker.instances[1].reply(["kimi"]);
    await retried;
  });

  it("rejects incomplete responses without caching a wrong line", async () => {
    const mod = await import("./engine/japaneseRomanization");
    const ready = mod.prepareJapaneseLyrics(["君", "ありがとう"]);
    FakeWorker.instances[0].reply(["kimi"]);
    await expect(ready).rejects.toThrow("Incomplete");
    expect(mod.readJapaneseRomanization("君")).toBeNull();
  });
});
