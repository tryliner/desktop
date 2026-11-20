// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import DropdownMenu, { type DropdownMenuItem } from "./DropdownMenu";

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

describe("DropdownMenu submenus", () => {
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
    document.body.innerHTML = "";
  });

  function render(items: DropdownMenuItem[], onOpenChange = vi.fn()) {
    act(() => {
      root.render(
        <DropdownMenu
          trigger={<span />}
          items={items}
          open
          onOpenChange={onOpenChange}
          position={{ x: 10, y: 10 }}
        />,
      );
    });
    return onOpenChange;
  }

  const button = (label: string) =>
    [...document.querySelectorAll("button")].find(
      (el) => el.textContent?.trim() === label,
    );

  it("opens a flyout on click without running the parent action", () => {
    const parent = vi.fn();
    const child = vi.fn();
    const onOpenChange = render([
      {
        id: "add",
        label: "Add to playlist",
        onClick: parent,
        children: [{ id: "c1", label: "Road trip", onClick: child }],
      },
    ]);
    expect(button("Road trip")).toBeUndefined();

    act(() => button("Add to playlist")!.click());
    expect(parent).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(button("Road trip")).toBeDefined();

    act(() => button("Road trip")!.click());
    expect(child).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("marks parents as having a popup and draws separators", () => {
    render([
      { id: "a", label: "Plain", onClick: vi.fn() },
      {
        id: "b",
        label: "Nested",
        onClick: vi.fn(),
        separator: true,
        children: [{ id: "c", label: "Child", onClick: vi.fn() }],
      },
    ]);
    expect(button("Nested")!.getAttribute("aria-haspopup")).toBe("menu");
    expect(button("Plain")!.getAttribute("aria-haspopup")).toBeNull();
    expect(document.querySelectorAll('[role="separator"]')).toHaveLength(1);
  });

  it("keeps the menu open when clicking inside the flyout", () => {
    const onOpenChange = render([
      {
        id: "add",
        label: "Add",
        onClick: vi.fn(),
        children: [{ id: "c1", label: "Child", onClick: vi.fn() }],
      },
    ]);
    act(() => button("Add")!.click());
    const flyoutButton = button("Child")!;
    act(() => {
      flyoutButton.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true }),
      );
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("closes when clicking inside another open menu", () => {
    const onOpenChange = render([{ id: "a", label: "A", onClick: vi.fn() }]);
    const other = document.createElement("div");
    other.setAttribute("data-dropdown-menu", "true");
    other.setAttribute("data-dropdown-owner", "someone-else");
    document.body.appendChild(other);
    act(() => {
      other.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
