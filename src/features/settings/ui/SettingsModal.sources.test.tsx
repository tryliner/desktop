// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useModalStore } from "@/features/library/store/modalStore";
import SettingsModal from "./SettingsModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/features/library", async () => {
  const { useModalStore } = await import("@/features/library/store/modalStore");
  return { useModalStore };
});

vi.mock("@/features/auth", () => ({
  useAuthStore: (selector: (state: { user: null; logout: () => Promise<void> }) => unknown) =>
    selector({ user: null, logout: vi.fn(async () => undefined) }),
}));

vi.mock("@/shared/ui/Dialog", () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
}));

vi.mock("./tabs", async () => {
  const { SourcesTab } = await import("./tabs/SourcesTab");
  const EmptyTab = () => null;
  return {
    PlaybackTab: EmptyTab,
    ShortcutsTab: EmptyTab,
    AppearanceTab: EmptyTab,
    CustomizationTab: EmptyTab,
    AudioTab: EmptyTab,
    StorageTab: EmptyTab,
    AboutTab: EmptyTab,
    OverlayTab: EmptyTab,
    DiscordTab: EmptyTab,
    SourcesTab,
  };
});

describe("SettingsModal source search", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useModalStore.setState({ settingsOpen: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    useModalStore.setState({ settingsOpen: false });
    document.body.replaceChildren();
  });

  it("finds and selects Sources when searching for SoundCloud", async () => {
    await act(async () => {
      root.render(<SettingsModal />);
    });

    const input = container.querySelector('input[placeholder="Search settings..."]') as HTMLInputElement;
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(input, "SoundCloud");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const sourcesTab = container.querySelector('button[role="tab"]') as HTMLButtonElement;
    expect(sourcesTab?.textContent).toContain("Sources");
    expect(sourcesTab?.getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("SoundCloud");
  });
});
