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
  const animId = useRef<number | null>(null);
  const dragSamples = useRef<Array<{ x: number; time: number }>>([]);

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
      if (animId.current !== null) {
        cancelAnimationFrame(animId.current);
        animId.current = null;
      }
    };
  }, []);

  const onMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const el = scrollRef.current;
      if (!el) return;

      if (animId.current !== null) {
        cancelAnimationFrame(animId.current);
        animId.current = null;
        suppressClick.current = true;
      }

      isMouseDown.current = true;
      hasDragged.current = false;
      startX.current = event.pageX;
      scrollLeft.current = el.scrollLeft;
      dragSamples.current = [{ x: event.pageX, time: performance.now() }];

      const onWindowMouseMove = (e: globalThis.MouseEvent) => {
        if (!isMouseDown.current) return;
        const now = performance.now();
        const delta = e.pageX - startX.current;
        if (!hasDragged.current && Math.abs(delta) > 5) {
          hasDragged.current = true;
          el.style.cursor = dragCursor;
          document.body.style.cursor = dragCursor;
          document.body.style.userSelect = "none";
        }
        if (hasDragged.current) {
          el.scrollLeft = scrollLeft.current - delta;
          dragSamples.current = dragSamples.current.filter(
            (s) => now - s.time <= 100,
          );
          dragSamples.current.push({ x: e.pageX, time: now });
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

          const samples = dragSamples.current;
          if (samples.length >= 2 && el) {
            const now = performance.now();
            const recentSamples = samples.filter((s) => now - s.time <= 120);
            if (recentSamples.length >= 2) {
              const first = recentSamples[0];
              const last = recentSamples[recentSamples.length - 1];
              const dt = last.time - first.time;
              const dx = last.x - first.x;
              if (dt > 10) {
                let velocity = dx / dt;
                const maxVelocity = 3.0;
                velocity = Math.max(-maxVelocity, Math.min(maxVelocity, velocity));
                if (Math.abs(velocity) > 0.15) {
                  let lastTime = performance.now();
                  const friction = 0.94;
                  const animateInertia = () => {
                    const currentTime = performance.now();
                    const elapsed = Math.min(currentTime - lastTime, 32);
                    lastTime = currentTime;
                    const decay = Math.pow(friction, elapsed / 16.67);
                    velocity *= decay;
                    if (Math.abs(velocity) < 0.02) {
                      animId.current = null;
                      return;
                    }
                    if (el) {
                      el.scrollLeft -= velocity * elapsed;
                      if (
                        el.scrollLeft <= 0 ||
                        Math.ceil(el.scrollLeft + el.clientWidth) >=
                          el.scrollWidth
                      ) {
                        animId.current = null;
                        return;
                      }
                    }
                    animId.current = requestAnimationFrame(animateInertia);
                  };
                  animId.current = requestAnimationFrame(animateInertia);
                }
              }
            }
          }
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
