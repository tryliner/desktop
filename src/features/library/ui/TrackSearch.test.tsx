import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

// @ts-expect-error - act support flag in vitest browserless DOM environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("framer-motion", () => {
  const cache: Record<string, any> = {};
  return {
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion: new Proxy(
      {},
      {
        get: (_target, prop: string) => {
          if (!cache[prop]) {
            cache[prop] = React.forwardRef(
              ({ children, ...props }: any, ref: any) => {
                const clean = { ...props };
                for (const k of [
                  "initial",
                  "animate",
                  "exit",
                  "transition",
                  "layoutId",
                ])
                  delete clean[k];
                return React.createElement(prop, { ref, ...clean }, children);
              },
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
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join("/")}` : key,
  }),
}));

import { TrackSearchField, useTrackSearch } from "./TrackSearch";

const TRACKS = [
  { title: "ДИНАСТИЯ", artists: "VILLIAN, madk1d" },
  { title: "Дві весни", artists: "Jerry Heil" },
  { title: "8 миля", artists: "madk1d, VILLIAN" },
];

let latest: ReturnType<typeof useTrackSearch<(typeof TRACKS)[number]>> | null =
  null;
const onSubmit = vi.fn();

function Harness({ resetKey = "a" }: { resetKey?: string }) {
  const search = useTrackSearch(TRACKS, resetKey);
  latest = search;
  return (
    <TrackSearchField
      search={search}
      totalCount={TRACKS.length}
      placeholder="Search in playlist"
      onSubmit={onSubmit}
    />
  );
}

function input(): HTMLInputElement | null {
  return document.querySelector("input");
}

function type(value: string) {
  const el = input()!;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function key(target: EventTarget, init: KeyboardEventInit) {
  const ev = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    target.dispatchEvent(ev);
  });
  return ev;
}

describe("track search", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onSubmit.mockReset();
    act(() => root.render(<Harness />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    latest = null;
  });

  it("is always visible and ctrl+f focuses it", () => {
    expect(input()).not.toBeNull();
    const ev = key(window, { code: "KeyF", key: "f", ctrlKey: true });
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input());
  });

  it("works with a Cyrillic layout because it uses the physical key", () => {
    key(window, { code: "KeyF", key: "а", ctrlKey: true });
    expect(document.activeElement).toBe(input());
  });

  it("filters, keeps original indices and shows the count", () => {
    type("madk1d");
    expect(latest!.matches?.map((m) => m.index)).toEqual([0, 2]);
    expect(container.textContent).toContain("track_search.count:2/3");
  });

  it("escape clears first, then blurs, and stops the app-wide escape", () => {
    act(() => latest!.focus());
    type("vill");
    const first = key(input()!, { key: "Escape" });
    expect(first.defaultPrevented).toBe(true);
    expect(latest!.query).toBe("");
    expect(document.activeElement).toBe(input());
    key(input()!, { key: "Escape" });
    expect(input()).not.toBeNull();
    expect(document.activeElement).not.toBe(input());
  });

  it("enter submits (plays the first match)", () => {
    type("весни");
    key(input()!, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("resets when the page changes", () => {
    type("vill");
    act(() => root.render(<Harness resetKey="b" />));
    expect(latest!.query).toBe("");
  });
});
