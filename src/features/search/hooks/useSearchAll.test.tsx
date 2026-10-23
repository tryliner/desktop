// @vitest-environment jsdom
import React, { type ReactElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/shared/api";
import type { SearchSource, SourcedSearchResult } from "@/shared/contracts";
import { useSearchAll, type UseSearchAllResult } from "./useSearchAll";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/shared/api", () => ({
  api: { search: vi.fn() },
}));

function item(id: string, source: "youtube" | "soundcloud"): SourcedSearchResult {
  return { type: "track", id, title: id, artists: [], durationMs: 1, source };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function Harness({
  query = "weeknd",
  enabled = true,
  source,
  debounceMs = 0,
  onResult,
}: {
  query?: string;
  enabled?: boolean;
  source?: SearchSource;
  debounceMs?: number;
  onResult: (value: UseSearchAllResult) => void;
}): ReactElement {
  const value = useSearchAll(query, {
    enabled,
    limit: 20,
    debounceMs,
    ...(source ? { source } : {}),
  });
  onResult(value);
  return <div>{value.items.map((entry) => entry.id).join(",")}</div>;
}

describe("useSearchAll", () => {
  let container: HTMLDivElement;
  let root: Root;
  let result: UseSearchAllResult | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  async function render({
    query = "weeknd",
    enabled = true,
    source,
    debounceMs = 0,
  }: {
    query?: string;
    enabled?: boolean;
    source?: SearchSource;
    debounceMs?: number;
  } = {}): Promise<void> {
    await act(async () => {
      root.render(
        <Harness
          query={query}
          enabled={enabled}
          source={source}
          debounceMs={debounceMs}
          onResult={(value) => { result = value; }}
        />,
      );
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
  }

  it("passes the selected source and abort signal to api.search", async () => {
    vi.mocked(api.search).mockResolvedValue({ items: [] });

    await render({ source: "youtube" });

    expect(api.search).toHaveBeenCalledWith("weeknd", "all", "youtube", expect.any(AbortSignal));
  });

  it("reruns the same query when the source changes", async () => {
    vi.mocked(api.search).mockResolvedValue({ items: [] });

    await render({ source: "youtube" });
    await render({ source: "soundcloud" });

    expect(api.search).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.search).mock.calls[1]?.[2]).toBe("soundcloud");
  });

  it("aborts the previous source request on source change", async () => {
    const pending = new Promise<never>(() => undefined);
    vi.mocked(api.search).mockReturnValue(pending);

    await render({ source: "youtube" });
    const firstSignal = vi.mocked(api.search).mock.calls[0]?.[3] as AbortSignal;
    await render({ source: "soundcloud" });

    expect(firstSignal.aborted).toBe(true);
  });

  it("does not let a slow previous source overwrite current results", async () => {
    const youtube = deferred<{ items: SourcedSearchResult[] }>();
    const soundcloud = deferred<{ items: SourcedSearchResult[] }>();
    vi.mocked(api.search)
      .mockReturnValueOnce(youtube.promise)
      .mockReturnValueOnce(soundcloud.promise);

    await render({ source: "youtube" });
    await render({ source: "soundcloud" });
    await act(async () => soundcloud.resolve({ items: [item("sc:1", "soundcloud")] }));
    await act(async () => youtube.resolve({ items: [item("yt-1", "youtube")] }));

    expect(result?.items.map((entry) => entry.id)).toEqual(["sc:1"]);
  });

  it("clears completed previous-source results while the new source loads", async () => {
    const soundcloud = deferred<{ items: SourcedSearchResult[] }>();
    vi.mocked(api.search)
      .mockResolvedValueOnce({ items: [item("yt-1", "youtube")] })
      .mockReturnValueOnce(soundcloud.promise);

    await render({ source: "youtube" });
    expect(result?.items.map((entry) => entry.id)).toEqual(["yt-1"]);

    await render({ source: "soundcloud" });

    expect(result?.items).toEqual([]);
    expect(result?.hasLoaded).toBe(false);
  });

  it("preserves completed results while disabled", async () => {
    vi.mocked(api.search).mockResolvedValue({ items: [item("yt-1", "youtube")] });

    await render({ source: "youtube" });
    await render({ source: "youtube", enabled: false });

    expect(result?.items.map(({ id }) => id)).toEqual(["yt-1"]);
    expect(result?.hasLoaded).toBe(true);
  });

  it("reuses completed results when the same key is re-enabled", async () => {
    vi.mocked(api.search).mockResolvedValue({ items: [item("yt-1", "youtube")] });

    await render({ source: "youtube" });
    await render({ source: "youtube", enabled: false });
    await render({ source: "youtube", enabled: true });

    expect(result?.items.map(({ id }) => id)).toEqual(["yt-1"]);
    expect(api.search).toHaveBeenCalledTimes(1);
  });

  it("clears completed results when the trimmed query changes", async () => {
    const replacement = deferred<{ items: SourcedSearchResult[] }>();
    vi.mocked(api.search)
      .mockResolvedValueOnce({ items: [item("yt-1", "youtube")] })
      .mockReturnValueOnce(replacement.promise);

    await render({ query: "weeknd", source: "youtube" });
    await render({ query: "  drake  ", source: "youtube" });

    expect(result?.items).toEqual([]);
    expect(result?.hasLoaded).toBe(false);
  });

  it("aborts an active request when disabled", async () => {
    vi.mocked(api.search).mockReturnValue(new Promise<never>(() => undefined));

    await render({ source: "youtube" });
    const signal = vi.mocked(api.search).mock.calls[0]?.[3] as AbortSignal;
    await render({ source: "youtube", enabled: false });

    expect(signal.aborted).toBe(true);
  });

  it("refetches after a forced refresh is aborted by disabling", async () => {
    vi.mocked(api.search).mockResolvedValueOnce({ items: [item("yt-1", "youtube")] });
    await render({ source: "youtube" });

    vi.mocked(api.search).mockReturnValueOnce(new Promise<never>(() => undefined));
    act(() => result?.runNow());
    await render({ source: "youtube", enabled: false });

    vi.mocked(api.search).mockResolvedValueOnce({ items: [item("yt-2", "youtube")] });
    await render({ source: "youtube", enabled: true });

    expect(api.search).toHaveBeenCalledTimes(3);
    expect(result?.items.map(({ id }) => id)).toEqual(["yt-2"]);
    expect(result?.hasLoaded).toBe(true);
  });

  it("refetches when a disabled key changes away and back after results were cleared", async () => {
    vi.mocked(api.search)
      .mockResolvedValueOnce({ items: [item("yt-1", "youtube")] })
      .mockResolvedValueOnce({ items: [item("yt-2", "youtube")] });
    await render({ query: "weeknd", source: "youtube" });

    await render({ query: "drake", source: "youtube", enabled: false });
    await render({ query: "weeknd", source: "youtube", enabled: false });
    await render({ query: "weeknd", source: "youtube", enabled: true });

    expect(api.search).toHaveBeenCalledTimes(2);
    expect(result?.items.map(({ id }) => id)).toEqual(["yt-2"]);
  });

  it("aborts a runNow request when the source changes", async () => {
    vi.mocked(api.search).mockResolvedValueOnce({ items: [] });
    await render({ source: "youtube" });

    vi.mocked(api.search).mockReturnValueOnce(new Promise<never>(() => undefined));
    act(() => result?.runNow());
    const runNowSignal = vi.mocked(api.search).mock.calls[1]?.[3] as AbortSignal;

    await render({ source: "soundcloud" });

    expect(runNowSignal.aborted).toBe(true);
  });

  it("cancels the pending debounce when runNow fires", async () => {
    vi.mocked(api.search).mockResolvedValue({ items: [] });
    await act(async () => {
      root.render(
        <Harness
          source="youtube"
          debounceMs={1_000}
          onResult={(value) => { result = value; }}
        />,
      );
    });

    await act(async () => result?.runNow());
    expect(api.search).toHaveBeenCalledTimes(1);

    await act(async () => vi.runAllTimersAsync());
    expect(api.search).toHaveBeenCalledTimes(1);
  });

  it("exposes failedSources from a partial all response", async () => {
    vi.mocked(api.search).mockResolvedValue({
      items: [item("yt-1", "youtube")],
      failedSources: ["soundcloud"],
    });

    await render({ source: "all" });

    expect(result?.failedSources).toEqual(["soundcloud"]);
  });

  it("defaults legacy callers to all", async () => {
    vi.mocked(api.search).mockResolvedValue({ items: [] });

    await render();

    expect(vi.mocked(api.search).mock.calls[0]?.[2]).toBe("all");
  });
});
