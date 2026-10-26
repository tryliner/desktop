import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LastfmBridge, LastfmStatus } from "@/features/lastfm/contracts";
import type { LinerElectronApi } from "../../../../../electron/preload";
import { LastfmTab } from "./LastfmTab";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/shared/ui", () => ({
  ToggleSwitch: ({ checked, disabled, onChange, ariaLabel }: any) => (
    <button
      aria-label={ariaLabel}
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  ),
}));

const disconnected: LastfmStatus = {
  configured: true,
  connected: false,
  authorizing: false,
  enabled: false,
  nowPlaying: true,
  pending: 0,
  sessionOnly: false,
};
let status: LastfmStatus;
let bridge: LastfmBridge;
let changed: (next: LastfmStatus) => void;
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  status = { ...disconnected };
  bridge = {
    status: vi.fn(async () => status),
    onChange: vi.fn((cb) => {
      changed = cb;
      return () => {};
    }),
    connect: vi.fn(async () => ({ ...status, authorizing: true })),
    finish: vi.fn(async () => ({
      ...status,
      connected: true,
      enabled: true,
      authorizing: false,
      username: "listener",
    })),
    cancel: vi.fn(async () => status),
    disconnect: vi.fn(async () => disconnected),
    settings: vi.fn(async (patch) => ({ ...status, ...patch })),
    retry: vi.fn(async () => status),
    scrobble: vi.fn(async () => true),
    updateNowPlaying: vi.fn(),
  };
  window.linerElectron = { lastfm: bridge } as LinerElectronApi;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete window.linerElectron;
});

async function render() {
  await act(async () => root.render(<LastfmTab />));
}
async function click(label: string) {
  const button = [...container.querySelectorAll("button")].find(
    (item) =>
      item.textContent === label || item.getAttribute("aria-label") === label,
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
}

describe("Last.fm settings", () => {
  it("completes browser authorization and exposes disconnect controls", async () => {
    await render();
    await click("Connect Last.fm");
    expect(bridge.connect).toHaveBeenCalledWith(undefined);
    expect(container.textContent).toContain("Approve Liner in your browser");
    await click("I have authorized Liner");
    expect(bridge.finish).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Connected as listener");
    await click("Disconnect");
    expect(bridge.disconnect).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Not connected");
  });

  it("allows clearing a revoked session and pending listens", async () => {
    status = {
      ...status,
      username: "listener",
      pending: 2,
      error: "reauthorize",
    };
    await render();
    expect(container.textContent).toContain(
      "Reconnect to resume pending scrobbles",
    );
    await click("Disconnect");
    expect(bridge.disconnect).toHaveBeenCalledTimes(1);
  });

  it("shows local credential inputs only when needed and masks the secret", async () => {
    status.configured = false;
    await render();
    expect(container.querySelectorAll("input")).toHaveLength(2);
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
    expect(
      [...container.querySelectorAll("button")].find(
        (item) => item.textContent === "Connect Last.fm",
      )?.disabled,
    ).toBe(true);
    expect(container.querySelector("a")?.href).toBe(
      "https://www.last.fm/api/account/create",
    );
  });

  it("updates preferences, receives live queue status, and shows the memory-only limitation", async () => {
    status = {
      ...status,
      connected: true,
      enabled: true,
      username: "listener",
    };
    await render();
    await click("Share Now Playing");
    expect(bridge.settings).toHaveBeenCalledWith({ nowPlaying: false });
    await act(async () =>
      changed({ ...status, pending: 3, sessionOnly: true }),
    );
    expect(container.textContent).toContain("Pending scrobbles: 3");
    expect(container.textContent).toContain("kept in memory");
    await click("Retry pending scrobbles");
    expect(bridge.retry).toHaveBeenCalledTimes(1);
  });

  it("shows failed actions without exposing raw error messages", async () => {
    vi.mocked(bridge.connect).mockRejectedValueOnce(
      new Error("raw secret should never appear"),
    );
    await render();
    await click("Connect Last.fm");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "action failed",
    );
    expect(container.textContent).not.toContain("raw secret");
  });
});
