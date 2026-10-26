import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DropdownMenu from "./DropdownMenu";

describe("DropdownMenu trigger arrow focus", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it.each([
    ["ArrowDown", false, false],
    ["ArrowUp", false, false],
    ["ArrowDown", true, false],
    ["ArrowUp", true, false],
    ["ArrowDown", false, true],
    ["ArrowUp", false, true],
    ["ArrowDown", true, true],
    ["ArrowUp", true, true],
  ])(
    "%s focuses an enabled item (pointer-open: %s, selected: %s)",
    (key, pointerOpen, selected) => {
      act(() =>
        root.render(
          <DropdownMenu
            trigger={<button type="button">Open</button>}
            items={[
              {
                id: "disabled",
                label: "Disabled",
                disabled: true,
                onClick: vi.fn(),
              },
              { id: "first", label: "First", onClick: vi.fn() },
              {
                id: "selected",
                label: "Selected",
                active: selected,
                onClick: vi.fn(),
              },
            ]}
          />,
        ),
      );
      const trigger = container.querySelector("button")!;
      act(() => trigger.focus());
      if (pointerOpen) {
        act(() =>
          trigger.dispatchEvent(
            new MouseEvent("click", { bubbles: true, detail: 1 }),
          ),
        );
        expect(document.activeElement).toBe(trigger);
      }
      act(() =>
        trigger.dispatchEvent(
          new KeyboardEvent("keydown", {
            key,
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
      const expected = [
        ...document.querySelectorAll("[role^='menuitem']"),
      ].find((item) => item.textContent === (selected ? "Selected" : "First"));
      expect(expected).toBeDefined();
      expect(document.activeElement).toBe(expected);
    },
  );
});
