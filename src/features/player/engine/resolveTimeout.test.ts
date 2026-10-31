import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/youtube", () => ({}));
vi.mock("@/shared/media/soundcloud", () => ({}));
vi.mock("@/shared/media/liner/linerPlayback", () => ({}));
vi.mock("@/shared/media/local", () => ({}));
vi.mock("@/shared/media/saved", () => ({}));
vi.mock("./youtubeStandIn", () => ({}));
vi.mock("./exactSongVersion", () => ({}));
vi.mock("./playbackStream", () => ({}));

const { withResolveTimeout, RESOLVE_TIMEOUT_MESSAGE } =
  await import("./streamResolver");

describe("withResolveTimeout", () => {
  it("gives up on a resolver that never settles and aborts it", async () => {
    let inner: AbortSignal | undefined;
    const pending = withResolveTimeout(
      undefined,
      (signal) => {
        inner = signal;
        return new Promise<never>(() => {});
      },
      20,
    );
    await expect(pending).rejects.toThrow(RESOLVE_TIMEOUT_MESSAGE);
    expect(inner?.aborted).toBe(true);
  });

  it("passes the caller's abort through", async () => {
    const controller = new AbortController();
    let inner: AbortSignal | undefined;
    const pending = withResolveTimeout(
      controller.signal,
      (signal) => {
        inner = signal;
        return new Promise<never>((_, reject) =>
          signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          ),
        );
      },
      10_000,
    );
    controller.abort();
    await expect(pending).rejects.toThrow("aborted");
    expect(inner?.aborted).toBe(true);
  });

  it("returns the stream when it arrives in time", async () => {
    await expect(
      withResolveTimeout(undefined, async () => "stream", 1_000),
    ).resolves.toBe("stream");
  });
});
