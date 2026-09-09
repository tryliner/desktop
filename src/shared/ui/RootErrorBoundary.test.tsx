import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act } from "react";
import { RootErrorBoundary, RootErrorFallback } from "./index";

function ProblematicChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Simulated component explosion");
  }
  return <div data-testid="child">Child content rendered normally</div>;
}

describe("RootErrorBoundary", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalConsoleError = console.error;

  beforeEach(() => {
    // Suppress React error boundary noise in console
    console.error = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    console.error = originalConsoleError;
    await act(async () => {
      root.unmount();
    });
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it("renders children when no error occurs", async () => {
    await act(async () => {
      root.render(
        <RootErrorBoundary>
          <ProblematicChild shouldThrow={false} />
        </RootErrorBoundary>,
      );
    });

    const child = container.querySelector('[data-testid="child"]');
    expect(child).not.toBeNull();
    expect(child?.textContent).toBe("Child content rendered normally");
  });

  it("catches error and renders the default fallback UI", async () => {
    const onError = vi.fn();

    await act(async () => {
      root.render(
        <RootErrorBoundary onError={onError}>
          <ProblematicChild shouldThrow={true} />
        </RootErrorBoundary>,
      );
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe("Simulated component explosion");

    const alertElement = container.querySelector('[role="alert"]');
    expect(alertElement).not.toBeNull();
    expect(container.textContent).toContain("Something went wrong");
    expect(container.textContent).toContain("Reload app");
    expect(container.textContent).toContain("Try again");
    expect(container.textContent).toContain("Go to home");
  });

  it("renders custom fallback function when provided", async () => {
    await act(async () => {
      root.render(
        <RootErrorBoundary
          fallback={({ error, resetErrorBoundary }) => (
            <div data-testid="custom-fallback">
              <span>Error: {error.message}</span>
              <button onClick={resetErrorBoundary}>Custom Reset</button>
            </div>
          )}
        >
          <ProblematicChild shouldThrow={true} />
        </RootErrorBoundary>,
      );
    });

    const fallbackEl = container.querySelector('[data-testid="custom-fallback"]');
    expect(fallbackEl).not.toBeNull();
    expect(fallbackEl?.textContent).toContain("Error: Simulated component explosion");
  });

  it("resets error boundary state when Try Again is clicked", async () => {
    let throwError = true;
    const onReset = vi.fn();

    function DynamicComponent() {
      const [hasError, setHasError] = useState(true);
      return (
        <RootErrorBoundary
          onReset={() => {
            onReset();
            setHasError(false);
          }}
        >
          <ProblematicChild shouldThrow={hasError} />
        </RootErrorBoundary>
      );
    }

    await act(async () => {
      root.render(<DynamicComponent />);
    });

    expect(container.querySelector('[role="alert"]')).not.toBeNull();

    // Find and click the Try Again button
    const buttons = Array.from(container.querySelectorAll("button"));
    const tryAgainBtn = buttons.find((btn) => btn.textContent?.includes("Try again"));
    expect(tryAgainBtn).toBeDefined();

    await act(async () => {
      tryAgainBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="child"]')).not.toBeNull();
  });

  it("toggles technical error details view", async () => {
    await act(async () => {
      root.render(
        <RootErrorBoundary>
          <ProblematicChild shouldThrow={true} />
        </RootErrorBoundary>,
      );
    });

    expect(container.textContent).not.toContain("JavaScript Stack Trace");

    const buttons = Array.from(container.querySelectorAll("button"));
    const detailsToggleBtn = buttons.find((btn) =>
      btn.textContent?.includes("Show technical details"),
    );
    expect(detailsToggleBtn).toBeDefined();

    await act(async () => {
      detailsToggleBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("JavaScript Stack Trace");
    expect(container.textContent).toContain("Simulated component explosion");
  });

  it("copies error details to clipboard", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    await act(async () => {
      root.render(
        <RootErrorBoundary>
          <ProblematicChild shouldThrow={true} />
        </RootErrorBoundary>,
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const copyBtn = buttons.find((btn) =>
      btn.textContent?.includes("Copy error details"),
    );
    expect(copyBtn).toBeDefined();

    await act(async () => {
      copyBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(writeTextMock.mock.calls[0][0]).toContain("Liner Desktop Client Error Report");
    expect(writeTextMock.mock.calls[0][0]).toContain("Simulated component explosion");
  });
});
