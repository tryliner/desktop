import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nProvider } from "@/languages";
import EnvironmentWarning from "./EnvironmentWarning";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function renderWarning() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      <I18nProvider>
        <EnvironmentWarning />
      </I18nProvider>,
    );
  });
  return { host, root };
}

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("EnvironmentWarning", () => {
  let mounts: { host: HTMLElement; root: Root }[] = [];

  beforeEach(() => {
    mounts = [];
    vi.stubGlobal("localStorage", createStorage());
    vi.stubGlobal("sessionStorage", createStorage());
    delete (window as unknown as Record<string, unknown>).linerElectron;
  });

  afterEach(() => {
    for (const { host, root } of mounts) {
      act(() => root.unmount());
      host.remove();
    }
    delete (window as unknown as Record<string, unknown>).linerElectron;
    vi.unstubAllGlobals();
  });

  it("warns in a plain browser and hides after skip", () => {
    const mounted = renderWarning();
    mounts.push(mounted);
    const banner = mounted.host.querySelector("button");
    expect(banner).not.toBeNull();
    expect(mounted.host.textContent).toMatch(/Electron/);
    act(() => {
      banner!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(sessionStorage.getItem("liner:env-warning-skipped")).toBe("1");
    expect(mounted.host.textContent).toBe("");
  });

  it("stays silent inside electron", () => {
    (window as unknown as Record<string, unknown>).linerElectron = {};
    const mounted = renderWarning();
    mounts.push(mounted);
    expect(mounted.host.textContent).toBe("");
  });
});
