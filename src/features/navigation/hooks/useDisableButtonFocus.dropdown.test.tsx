import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DropdownMenu from "@/shared/ui/DropdownMenu";
import { useDisableButtonFocus } from "./useDisableButtonFocus";

function Harness() {
  useDisableButtonFocus();
  return (
    <>
      <DropdownMenu
        trigger={<button type="button">Open menu</button>}
        items={[{ id: "action", label: "Action", onClick: vi.fn() }]}
      />
      <button type="button">Ordinary button</button>
    </>
  );
}

describe("dropdown trigger focus with global button focus suppression", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Harness />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it.each(["Escape", "selection"])(
    "preserves trigger focus after %s closes the menu",
    (closeMethod) => {
      const trigger = container.querySelector("button")!;
      act(() =>
        trigger.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "ArrowDown",
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
      const item =
        document.querySelector<HTMLButtonElement>("[role='menuitem']")!;
      expect(document.activeElement).toBe(item);
      act(() => {
        if (closeMethod === "selection") item.click();
        else
          item.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
          );
      });
      expect(document.activeElement).toBe(trigger);
    },
  );

  it("continues blurring ordinary buttons", () => {
    const ordinary = container.querySelectorAll("button")[1];
    act(() => ordinary.focus());
    expect(document.activeElement).not.toBe(ordinary);
  });
});
