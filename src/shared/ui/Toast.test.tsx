import React, { act } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider, showToast, useToast } from "./Toast";

// @ts-expect-error - act support flag in vitest browserless DOM environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function ToastTester() {
  const { toast } = useToast();
  return (
    <div>
      <button
        data-testid="fire-toast-1"
        onClick={() =>
          toast("First Title", "info", {
            description: "First Description",
            action: { label: "Action 1", onClick: vi.fn() },
          })
        }
      >
        Fire 1
      </button>
      <button
        data-testid="fire-toast-2"
        onClick={() =>
          toast("Second Title", "success", {
            description: "Second Description",
            action: { label: "Action 2", onClick: vi.fn() },
          })
        }
      >
        Fire 2
      </button>
    </div>
  );
}

describe("Toast Batches & Stacking", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it("renders a single toast in the main slot", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ToastProvider>
            <ToastTester />
          </ToastProvider>
        </MemoryRouter>,
      );
    });

    await act(async () => {
      showToast("Playing track", "info", { description: "Artist - Song" });
    });

    expect(container.textContent).toContain("Playing track");
    expect(container.textContent).toContain("Artist - Song");
  });

  it("stacks multiple notifications as full cards in the batch deck instead of mock slabs", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ToastProvider>
            <ToastTester />
          </ToastProvider>
        </MemoryRouter>,
      );
    });

    const fire1 = container.querySelector('[data-testid="fire-toast-1"]') as HTMLButtonElement;
    const fire2 = container.querySelector('[data-testid="fire-toast-2"]') as HTMLButtonElement;

    // Fire first toast
    await act(async () => {
      fire1.click();
    });

    // Fire second toast to form a batch
    await act(async () => {
      fire2.click();
    });

    // Both notification cards must exist simultaneously in the DOM
    expect(container.textContent).toContain("Second Title");
    expect(container.textContent).toContain("First Title");
    expect(container.textContent).toContain("Action 1");
    expect(container.textContent).toContain("Action 2");

    // Check that top card has pointer-events-auto and background card has pointer-events-none
    const cards = container.querySelectorAll(".grid > div");
    expect(cards.length).toBe(2);

    const topCard = cards[0] as HTMLElement;
    const batchCard = cards[1] as HTMLElement;

    expect(topCard.className).toContain("pointer-events-auto");
    expect(batchCard.className).toContain("pointer-events-none");
  });

  it("promotes background batch card to main slot when top card action is triggered", async () => {
    const onAction2 = vi.fn();

    await act(async () => {
      root.render(
        <MemoryRouter>
          <ToastProvider>
            <div>app</div>
          </ToastProvider>
        </MemoryRouter>,
      );
    });

    await act(async () => {
      showToast("First Title", "info", { description: "First Description" });
    });

    await act(async () => {
      showToast("Second Title", "success", {
        description: "Second Description",
        action: { label: "Dismiss Top", onClick: onAction2 },
      });
    });

    // Top card has the action button "Dismiss Top"
    const actionBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Dismiss Top",
    );
    expect(actionBtn).toBeDefined();

    // Clicking action dismisses the top card
    await act(async () => {
      actionBtn?.click();
    });

    expect(onAction2).toHaveBeenCalledTimes(1);

    // After dismissal, First Title remains and becomes the active card
    expect(container.textContent).toContain("First Title");
  });

  it("supports custom callable with checkmark and loader helper methods", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ToastProvider>
            <div>app</div>
          </ToastProvider>
        </MemoryRouter>,
      );
    });

    // Checkmark variant
    await act(async () => {
      showToast.checkmark("Checkmark title");
    });
    expect(container.textContent).toContain("Checkmark title");

    // Loader variant
    await act(async () => {
      showToast.loader("Loader title", { description: "Processing..." });
    });
    expect(container.textContent).toContain("Loader title");
    expect(container.textContent).toContain("Processing...");
    // Loader has animate-spin spinner svg
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("supports custom icon and button option with balanced padding", async () => {
    const onButtonClick = vi.fn();

    await act(async () => {
      root.render(
        <MemoryRouter>
          <ToastProvider>
            <div>app</div>
          </ToastProvider>
        </MemoryRouter>,
      );
    });

    // Card with button has pr-[5px] so top, bottom, and right padding all equal 5px
    await act(async () => {
      showToast("Custom card", {
        icon: <span data-testid="my-icon">★</span>,
        button: { label: "Undo", onClick: onButtonClick },
      });
    });

    expect(container.querySelector('[data-testid="my-icon"]')).not.toBeNull();
    const btn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Undo",
    );
    expect(btn).toBeDefined();

    const card = container.querySelector(".grid > div") as HTMLElement;
    expect(card.className).toContain("pr-[5px]");
    expect(card.className).toContain("py-[5px]");
    expect(card.className).toContain("pl-[12px]");

    await act(async () => {
      btn?.click();
    });
    expect(onButtonClick).toHaveBeenCalledTimes(1);
  });

  it("maintains the same baseline height and width when there is no button", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ToastProvider>
            <div>app</div>
          </ToastProvider>
        </MemoryRouter>,
      );
    });

    await act(async () => {
      showToast("Plain notification");
    });

    const card = container.querySelector(".grid > div") as HTMLElement;
    expect(card.className).toContain("min-h-[38px]");
    expect(card.style.minWidth).toContain("180px");
    expect(card.style.minHeight).toBe("38px");
  });
});
