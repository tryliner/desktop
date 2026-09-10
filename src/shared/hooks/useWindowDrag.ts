import { useEffect } from "react";

export interface WindowDragOptions {
  /**
   * Height in pixels of the top strip area that triggers dragging (default: 32).
   */
  topAreaHeight?: number;
  /**
   * Minimum movement in pixels required before window drag begins (default: 5).
   */
  dragThreshold?: number;
  /**
   * Selector for elements that should NOT trigger drag even if inside the drag area.
   */
  ignoreSelector?: string;
  /**
   * Enable double click on non-interactive drag area to toggle window maximize (default: true).
   */
  enableDoubleClickMaximize?: boolean;
}

export const DEFAULT_WINDOW_DRAG_IGNORE_SELECTOR = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "label",
  "[role='button']",
  "[role='tab']",
  "[role='menuitem']",
  "[role='slider']",
  "[role='switch']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='option']",
  "[data-no-window-drag]",
  ".no-drag",
].join(", ");

let lastWindowDragTime = 0;

export function isWindowDraggingActive(): boolean {
  return Date.now() - lastWindowDragTime < 350;
}

export function resetWindowDragTimeForTests(): void {
  lastWindowDragTime = 0;
}

export function useWindowDrag({
  topAreaHeight = 32,
  dragThreshold = 5,
  ignoreSelector = DEFAULT_WINDOW_DRAG_IGNORE_SELECTOR,
  enableDoubleClickMaximize = true,
}: WindowDragOptions = {}) {
  useEffect(() => {
    let isMouseDown = false;
    let isDragging = false;
    let startScreenX = 0;
    let startScreenY = 0;
    let lastScreenX = 0;
    let lastScreenY = 0;

    const isInteractive = (target: HTMLElement | null): boolean => {
      if (!target) return false;
      return Boolean(target.closest(ignoreSelector));
    };

    const isInDraggableRegion = (target: HTMLElement | null, clientY: number): boolean => {
      if (clientY <= topAreaHeight) return true;
      if (target?.closest("[data-window-drag]")) return true;
      return false;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isMouseDown) return;

      if (!isDragging) {
        const distance = Math.hypot(
          e.screenX - startScreenX,
          e.screenY - startScreenY,
        );
        if (distance < dragThreshold) {
          return;
        }
        isDragging = true;
        // signal main process to lock cursor origin for smooth wayland drag
        window.linerElectron?.dragStart?.();
      }

      const deltaX = e.screenX - lastScreenX;
      const deltaY = e.screenY - lastScreenY;
      lastScreenX = e.screenX;
      lastScreenY = e.screenY;

      if (deltaX !== 0 || deltaY !== 0) {
        lastWindowDragTime = Date.now();
        window.linerElectron?.dragMove(deltaX, deltaY);
      }
    };

    const handlePointerUp = () => {
      if (isDragging) {
        lastWindowDragTime = Date.now();
        window.linerElectron?.dragEnd?.();
      }
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", handlePointerUp, { capture: true });
      window.removeEventListener("pointercancel", handlePointerUp, { capture: true });

      isMouseDown = false;
      isDragging = false;
    };

    const handlePointerDown = (e: PointerEvent) => {
      // Only left mouse button (e.button === 0)
      if (e.button !== 0) return;
      if (e.pointerType && e.pointerType !== "mouse") return;

      const target = e.target as HTMLElement | null;
      if (!isInDraggableRegion(target, e.clientY)) return;
      if (isInteractive(target)) return;

      isMouseDown = true;
      isDragging = false;
      startScreenX = e.screenX;
      startScreenY = e.screenY;
      lastScreenX = e.screenX;
      lastScreenY = e.screenY;

      // trigger OS native window drag loop immediately (handles wayland windowing smoothly)
      lastWindowDragTime = Date.now();
      window.linerElectron?.startWindowMove?.();

      window.addEventListener("pointermove", handlePointerMove, { capture: true });
      window.addEventListener("pointerup", handlePointerUp, { capture: true });
      window.addEventListener("pointercancel", handlePointerUp, { capture: true });
    };

    const handleDoubleClick = (e: MouseEvent) => {
      if (!enableDoubleClickMaximize) return;
      if (e.button !== 0) return;
      if (isWindowDraggingActive()) return;

      const target = e.target as HTMLElement | null;
      if (!isInDraggableRegion(target, e.clientY)) return;
      if (isInteractive(target)) return;

      window.linerElectron?.toggleMaximize();
    };

    window.addEventListener("pointerdown", handlePointerDown, { capture: true });
    window.addEventListener("dblclick", handleDoubleClick, { capture: true });

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      window.removeEventListener("dblclick", handleDoubleClick, { capture: true });
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", handlePointerUp, { capture: true });
      window.removeEventListener("pointercancel", handlePointerUp, { capture: true });
    };
  }, [topAreaHeight, dragThreshold, ignoreSelector, enableDoubleClickMaximize]);
}

export default useWindowDrag;
