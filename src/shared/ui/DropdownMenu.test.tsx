// @vitest-environment jsdom
import React, { act } from "react";
import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DropdownMenu from "./DropdownMenu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("DropdownMenu", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
  });

  async function openMenu(items: React.ComponentProps<typeof DropdownMenu>["items"]): Promise<void> {
    await act(async () => {
      root.render(
        <DropdownMenu
          trigger={<button type="button">Open menu</button>}
          items={items}
        />,
      );
    });
    act(() => {
      (container.querySelector("button") as HTMLButtonElement).click();
    });
  }

  it("exposes checked items as menu item checkboxes with a visible check", async () => {
    await openMenu([{ id: "youtube", label: "YouTube Music", checked: true, onClick: vi.fn() }]);

    const item = document.body.querySelector('[role="menuitemcheckbox"]');
    expect(item?.getAttribute("aria-checked")).toBe("true");
    expect(item?.querySelector('[data-dropdown-check="true"]')).not.toBeNull();
  });

  it("keeps the menu open when a multi-select item is activated", async () => {
    const onClick = vi.fn();
    const onOpenChange = vi.fn();
    await act(async () => {
      root.render(
        <DropdownMenu
          open
          onOpenChange={onOpenChange}
          trigger={<button type="button">Open menu</button>}
          items={[{
            id: "soundcloud",
            label: "SoundCloud",
            closeOnSelect: false,
            onClick,
          }]}
        />,
      );
    });

    const item = document.body.querySelector("[data-dropdown-menu] button") as HTMLButtonElement;
    await act(async () => item.click());

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("supports menu arrow navigation and restores trigger focus on Escape", async () => {
    function KeyboardMenu() {
      const [open, setOpen] = useState(false);
      return (
        <DropdownMenu
          open={open}
          onOpenChange={setOpen}
          trigger={<button type="button">Open sources</button>}
          items={[
            { id: "youtube", label: "YouTube Music", checked: true, closeOnSelect: false, onClick: vi.fn() },
            { id: "soundcloud", label: "SoundCloud", checked: false, closeOnSelect: false, onClick: vi.fn() },
            { id: "soon", label: "Coming soon", onClick: vi.fn() },
          ]}
        />
      );
    }

    await act(async () => root.render(<KeyboardMenu />));
    const trigger = container.querySelector("button") as HTMLButtonElement;
    await act(async () => trigger.click());

    const menu = document.body.querySelector('[role="menu"]') as HTMLElement;
    const youtube = document.body.querySelector('[aria-label="YouTube Music"]') as HTMLButtonElement;
    const soundcloud = document.body.querySelector('[aria-label="SoundCloud"]') as HTMLButtonElement;
    const comingSoon = document.body.querySelector('[aria-label="Coming soon"]') as HTMLButtonElement;
    expect(document.activeElement).toBe(youtube);

    await act(async () => youtube.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect(document.activeElement).toBe(soundcloud);
    await act(async () => soundcloud.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })));
    expect(document.activeElement).toBe(comingSoon);
    await act(async () => comingSoon.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
    expect(document.activeElement).toBe(youtube);

    await act(async () => menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(document.activeElement).toBe(trigger);
  });
});
