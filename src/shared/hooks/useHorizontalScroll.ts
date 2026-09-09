import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent, MouseEventHandler, RefObject } from "react";

export interface HorizontalScrollOptions {
  wheelMultiplier?: number;
  dragCursor?: string;
}

export interface HorizontalScrollHandlers {
  onMouseDown: MouseEventHandler<HTMLDivElement>;
  onMouseMove: MouseEventHandler<HTMLDivElement>;
  onMouseUp: MouseEventHandler<HTMLDivElement>;
  onMouseLeave: MouseEventHandler<HTMLDivElement>;
  onClickCapture: MouseEventHandler<HTMLDivElement>;
}

export interface UseHorizontalScrollResult {
  scrollRef: RefObject<HTMLDivElement | null>;
  showLeftShadow: boolean;
  showRightShadow: boolean;
  handlers: HorizontalScrollHandlers;
}

export function useHorizontalScroll(
  options: HorizontalScrollOptions = {},
): UseHorizontalScrollResult {
  const { wheelMultiplier = 5, dragCursor = "grabbing" } = options;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(true);

  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const suppressClick = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const stopDragging = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isDragging.current = false;
    el.style.removeProperty("cursor");
    el.style.removeProperty("user-select");
  }, []);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft: currentScroll, scrollWidth, clientWidth } = el;
    setShowLeftShadow(currentScroll > 0);
    setShowRightShadow(Math.ceil(currentScroll + clientWidth) < scrollWidth);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;

      const { scrollLeft: currentScroll, scrollWidth, clientWidth } = el;
      const canScrollRight =
        Math.ceil(currentScroll + clientWidth) < scrollWidth;
      const canScrollLeft = currentScroll > 0;
      const scrollingRight = event.deltaY > 0;
      const scrollingLeft = event.deltaY < 0;

      if (
        (scrollingRight && canScrollRight) ||
        (scrollingLeft && canScrollLeft)
      ) {
        event.preventDefault();
        el.scrollTo({
          left: el.scrollLeft + event.deltaY * wheelMultiplier,
          behavior: "smooth",
        });
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);

    checkScroll();

    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, wheelMultiplier]);

  const onMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const el = scrollRef.current;
      if (!el) return;
      isDragging.current = true;
      hasDragged.current = false;
      startX.current = event.pageX - el.offsetLeft;
      scrollLeft.current = el.scrollLeft;
      el.style.cursor = dragCursor;
      el.style.userSelect = "none";
    },
    [dragCursor],
  );

  const onMouseMove = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const el = scrollRef.current;
    if (!el) return;
    event.preventDefault();
    const x = event.pageX - el.offsetLeft;
    const delta = Math.abs(x - startX.current);
    if (delta > 4) {
      hasDragged.current = true;
    }
    const walk = (x - startX.current) * 1.5;
    el.scrollLeft = scrollLeft.current - walk;
  }, []);

  const onMouseUp = useCallback(() => {
    if (hasDragged.current) {
      suppressClick.current = true;
    }
    stopDragging();
  }, [stopDragging]);

  const onMouseLeave = useCallback(() => {
    if (hasDragged.current) {
      suppressClick.current = true;
    }
    stopDragging();
  }, [stopDragging]);

  const onClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!suppressClick.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick.current = false;
  }, []);

  return {
    scrollRef,
    showLeftShadow,
    showRightShadow,
    handlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave,
      onClickCapture,
    },
  };
}

export default useHorizontalScroll;
