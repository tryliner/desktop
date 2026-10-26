import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import DropdownMenu from "./DropdownMenu";

it("clears keyboard-open focus after selection before a controlled reopen", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onSelect = vi.fn();

  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Context open
        </button>
        <DropdownMenu
          trigger={<button type="button">Menu trigger</button>}
          items={[{ id: "item", label: "Select item", onClick: onSelect }]}
          open={open}
          onOpenChange={setOpen}
          position={{ x: 10, y: 10 }}
        />
      </>
    );
  }

  try {
    act(() => root.render(<Harness />));
    const [contextOpen, trigger] = container.querySelectorAll("button");
    act(() => {
      trigger.focus();
      trigger.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    const item =
      document.querySelector<HTMLButtonElement>("[role='menuitem']")!;
    expect(document.activeElement).toBe(item);

    await act(async () => item.click());
    expect(onSelect).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);

    act(() => {
      contextOpen.focus();
      contextOpen.dispatchEvent(
        new MouseEvent("click", { bubbles: true, detail: 1 }),
      );
    });
    expect(document.querySelector("[role='menu']")).not.toBeNull();
    expect(document.activeElement).toBe(contextOpen);
  } finally {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
