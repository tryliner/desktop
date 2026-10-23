// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchSourceBadge } from "./SearchSourceBadge";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SearchSourceBadge", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders compact provider-colored icons without provider-name text", async () => {
    await act(async () => {
      root.render(
        <>
          <SearchSourceBadge source="youtube" />
          <SearchSourceBadge source="soundcloud" />
        </>,
      );
    });

    const youtube = container.querySelector('[data-source-badge="youtube"]') as HTMLElement;
    const soundcloud = container.querySelector('[data-source-badge="soundcloud"]') as HTMLElement;
    expect(container.textContent).toBe("");
    expect(youtube.className).toContain("text-[#ff0033]");
    expect(soundcloud.className).toContain("text-[#ff5500]");
    expect(youtube.className).toContain("h-[16px]");
    expect(youtube.className).toContain("w-[16px]");
    expect(youtube.className).not.toContain("bg-[#ff0033]");
  });

  it("renders safe SoundCloud attribution and stops pointer and click row playback", async () => {
    const onRowClick = vi.fn();
    const onRowPointerDown = vi.fn();
    await act(async () => {
      root.render(
        <div onClick={onRowClick} onPointerDown={onRowPointerDown}>
          <SearchSourceBadge
            source="soundcloud"
            externalUrl="https://soundcloud.com/u/t"
          />
        </div>,
      );
    });

    const link = container.querySelector('a[aria-label="Open on SoundCloud"]') as HTMLAnchorElement;
    expect(link.target).toBe("_blank");
    expect(link.rel.split(" ")).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
    act(() => {
      link.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      link.click();
    });
    expect(onRowPointerDown).not.toHaveBeenCalled();
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("does not bubble keyboard activation from a provider link to the row", async () => {
    const onRowKeyDown = vi.fn();
    await act(async () => {
      root.render(
        <div onKeyDown={onRowKeyDown}>
          <SearchSourceBadge
            source="soundcloud"
            externalUrl="https://soundcloud.com/u/t"
          />
        </div>,
      );
    });

    const link = container.querySelector('a[aria-label="Open on SoundCloud"]') as HTMLAnchorElement;
    link.focus();
    act(() => link.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));

    expect(onRowKeyDown).not.toHaveBeenCalled();
  });

  it("renders nothing for legacy results without a source", async () => {
    await act(async () => {
      root.render(<SearchSourceBadge />);
    });

    expect(container.innerHTML).toBe("");
  });

  it("does not link an untrusted external URL", async () => {
    const onRowClick = vi.fn();
    await act(async () => {
      root.render(
        <div onClick={onRowClick}>
          <SearchSourceBadge
            source="soundcloud"
            externalUrl="https://example.com/not-soundcloud"
          />
        </div>,
      );
    });

    expect(container.querySelector("a")).toBeNull();
    const badge = container.querySelector('[data-source-badge="soundcloud"]');
    expect(badge?.getAttribute("aria-label")).toBe("SoundCloud");
    expect(badge?.getAttribute("title")).toBe("SoundCloud");
    act(() => (badge as HTMLElement).click());
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
