import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act } from "react";
import { useDisableButtonFocus } from "./useDisableButtonFocus";

function Harness() {
  useDisableButtonFocus();
  return null;
}

describe("useDisableButtonFocus", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    if (root && container) {
      act(() => {
        root!.unmount();
      });
      document.body.removeChild(container);
    }
    root = null;
    container = null;
    document.body.innerHTML = "";
  });

  function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(<Harness />);
    });
  }

  it("blurs a native <button> the moment it gains focus", () => {
    mount();
    const button = document.createElement("button");
    document.body.appendChild(button);

    act(() => {
      button.focus();
    });

    expect(document.activeElement).not.toBe(button);
  });

  it("blurs a role=\"button\" element the moment it gains focus", () => {
    mount();
    const div = document.createElement("div");
    div.setAttribute("role", "button");
    div.tabIndex = 0;
    document.body.appendChild(div);

    act(() => {
      div.focus();
    });

    expect(document.activeElement).not.toBe(div);
  });

  it("leaves an unrelated focusable element (e.g. an input) focused", () => {
    mount();
    const input = document.createElement("input");
    document.body.appendChild(input);

    act(() => {
      input.focus();
    });

    expect(document.activeElement).toBe(input);
  });
});
