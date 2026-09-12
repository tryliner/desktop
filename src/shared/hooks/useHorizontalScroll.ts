import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, MouseEventHandler, RefObject } from "react";

export interface HorizontalScrollOptions {
  dragCursor?: string;
  wheelMultiplier?: number;
}

export interface HorizontalScrollHandlers {
  onMouseDown: MouseEventHandler<HTMLDivElement>;
  onClickCapture: MouseEventHandler<HTMLDivElement>;
  onDragStart: (event: React.DragEvent) => void;
}

export interface UseHorizontalScrollResult {
  scrollRef: RefObject<HTMLDivElement | null>;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  showLeftShadow: boolean;
  showRightShadow: boolean;
  scrollPrev: () => void;
  scrollNext: () => void;
  handlers: HorizontalScrollHandlers;
}

export function useHorizontalScroll(
  options: HorizontalScrollOptions = {},
): UseHorizontalScrollResult {
  const { dragCursor = "grabbing" } = options;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);

  const isMouseDown = useRef(false);
  const hasDragged = useRef(false);
  const suppressClick = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft: currentScroll, scrollWidth, clientWidth } = el;
    setShowLeftShadow(currentScroll > 1);
    setShowRightShadow(Math.ceil(currentScroll + clientWidth) < scrollWidth - 1);
  }, []);

  const scrollPrev = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.75, 200);
    el.scrollBy({ left: -step, behavior: "smooth" });
  }, []);

  const scrollNext = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.75, 200);
    el.scrollBy({ left: step, behavior: "smooth" });
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScroll();

    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);

    const resizeObserver = new ResizeObserver(() => {
      checkScroll();
    });
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
      resizeObserver.disconnect();
    };
  }, [checkScroll]);

  useEffect(() => {
    return () => {
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
  }, []);

  const onMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const el = scrollRef.current;
      if (!el) return;

      isMouseDown.current = true;
      hasDragged.current = false;
      startX.current = event.pageX;
      scrollLeft.current = el.scrollLeft;

      const onWindowMouseMove = (e: globalThis.MouseEvent) => {
        if (!isMouseDown.current) return;
        const delta = e.pageX - startX.current;
        if (!hasDragged.current && Math.abs(delta) > 5) {
          hasDragged.current = true;
          el.style.cursor = dragCursor;
          document.body.style.cursor = dragCursor;
          document.body.style.userSelect = "none";
        }
        if (hasDragged.current) {
          el.scrollLeft = scrollLeft.current - delta;
        }
      };

      const onWindowMouseUp = () => {
        if (!isMouseDown.current) return;
        isMouseDown.current = false;
        window.removeEventListener("mousemove", onWindowMouseMove);
        window.removeEventListener("mouseup", onWindowMouseUp);

        document.body.style.removeProperty("cursor");
        document.body.style.removeProperty("user-select");
        if (el) {
          el.style.removeProperty("cursor");
        }

        if (hasDragged.current) {
          suppressClick.current = true;
          hasDragged.current = false;
          setTimeout(() => {
            suppressClick.current = false;
          }, 50);
        }
      };

      window.addEventListener("mousemove", onWindowMouseMove);
      window.addEventListener("mouseup", onWindowMouseUp);
    },
    [dragCursor],
  );

  const onClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick.current = false;
    }
  }, []);

  const onDragStart = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  return {
    scrollRef,
    canScrollLeft: showLeftShadow,
    canScrollRight: showRightShadow,
    showLeftShadow,
    showRightShadow,
    scrollPrev,
    scrollNext,
    handlers: {
      onMouseDown,
      onClickCapture,
      onDragStart,
    },
  };
}

export default useHorizontalScroll;
