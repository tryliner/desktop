import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

vi.mock("framer-motion", () => {
  const cache: Record<string, unknown> = {};
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    motion: new Proxy(
      {},
      {
        get: (_target, prop: string) => {
          if (!cache[prop]) {
            cache[prop] = React.forwardRef(
              (
                {
                  children,
                  initial: _initial,
                  animate: _animate,
                  exit: _exit,
                  transition: _transition,
                  ...props
                }: Record<string, unknown> & { children?: React.ReactNode },
                ref,
              ) => React.createElement(prop, { ref, ...props }, children),
            );
          }
          return cache[prop];
        },
      },
    ),
  };
});

vi.mock("@/languages", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));

vi.mock("@/shared/utils/cacheManager", () => ({
  formatStorageBytes: (bytes: number) => `${bytes} B`,
}));

import { SignOutDialog } from "./SignOutDialog";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function buttonWithText(text: string): HTMLButtonElement {
  const match = [...document.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === text,
  );
  if (!match) throw new Error(`no button "${text}"`);
  return match as HTMLButtonElement;
}

describe("SignOutDialog", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onSignOut = vi.fn();
  const onCancel = vi.fn();

  const render = (open = true) =>
    act(() => {
      root.render(
        <SignOutDialog
          open={open}
          songCount={12}
          bytes={300}
          onCancel={onCancel}
          onSignOut={onSignOut}
        />,
      );
    });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onSignOut.mockReset();
    onCancel.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  it("removes downloads unless the user turns keeping on", () => {
    render();
    expect(document.body.textContent).toContain(
      "settings.storage.sign_out_desc_remove",
    );

    act(() => buttonWithText("settings.storage.sign_out_confirm").click());

    expect(onSignOut).toHaveBeenCalledWith(false, false);
  });

  it("keeps downloads and remembers the choice from the quiet button", () => {
    render();
    const toggle = document.querySelector(
      'button[aria-label="settings.storage.sign_out_keep_toggle"]',
    ) as HTMLButtonElement;
    act(() => toggle.click());

    expect(document.body.textContent).toContain(
      "settings.storage.sign_out_desc_keep",
    );
    act(() => buttonWithText("settings.storage.sign_out_dont_ask").click());

    expect(onSignOut).toHaveBeenCalledWith(true, true);
  });

  it("cancels without signing out", () => {
    render();
    act(() => buttonWithText("common.cancel").click());

    expect(onCancel).toHaveBeenCalled();
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it("starts from remove every time it opens", () => {
    render();
    const toggle = document.querySelector(
      'button[aria-label="settings.storage.sign_out_keep_toggle"]',
    ) as HTMLButtonElement;
    act(() => toggle.click());
    render(false);
    render(true);

    act(() => buttonWithText("settings.storage.sign_out_confirm").click());
    expect(onSignOut).toHaveBeenCalledWith(false, false);
  });
});
