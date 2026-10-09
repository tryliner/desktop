import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

interface TooltipTargetData {
  text: string;
  targetRect: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  };
  side: "top" | "bottom";
}

function GlobalTooltipPortal({ text, targetRect, side: requestedSide }: TooltipTargetData) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>(() => {
    const isTopTooClose = targetRect.top < 38;
    const side = requestedSide === "top" && isTopTooClose ? "bottom" : requestedSide;
    const initialTop = Math.round(side === "top" ? targetRect.top - 28 - 6 : targetRect.bottom + 6);
    const initialLeft = Math.round(targetRect.left + (targetRect.width - 80) / 2);
    return { top: Math.max(8, initialTop), left: Math.max(8, initialLeft) };
  });

  useLayoutEffect(() => {
    if (!tooltipRef.current || typeof window === "undefined") return;

    const width = tooltipRef.current.offsetWidth || 80;
    const height = tooltipRef.current.offsetHeight || 26;
    const margin = 8;
    const sideOffset = 6;

    let side = requestedSide;
    if (side === "top" && targetRect.top - height - sideOffset < margin) {
      side = "bottom";
    } else if (
      side === "bottom" &&
      targetRect.bottom + height + sideOffset > window.innerHeight - margin
    ) {
      side = "top";
    }

    // Precise integer coordinates snapped to whole pixels to prevent subpixel blur
    const rawLeft = targetRect.left + (targetRect.width - width) / 2;
    const clampedLeft = Math.min(
      Math.max(rawLeft, margin),
      window.innerWidth - width - margin
    );
    const finalLeft = Math.round(clampedLeft);

    const rawTop = side === "top" ? targetRect.top - height - sideOffset : targetRect.bottom + sideOffset;
    const finalTop = Math.round(rawTop);

    setCoords({ top: finalTop, left: finalLeft });
  }, [text, targetRect, requestedSide]);

  return (
    <div
      ref={tooltipRef}
      className="pointer-events-none fixed z-[9999]"
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`,
      }}
    >
      <motion.div
        role="tooltip"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.08, ease: "easeOut" }}
        className="rounded-lg border-0 bg-[#1c1c1f] px-2.5 py-1 text-[12px] font-medium text-white shadow-xl shadow-black/50 whitespace-nowrap leading-tight select-none subpixel-antialiased"
        style={{
          fontFamily: "var(--font-inter), sans-serif",
          textRendering: "geometricPrecision",
        }}
      >
        {text}
      </motion.div>
    </div>
  );
}

/**
 * Global lightweight tooltip manager:
 * 1. Proactively intercepts and neutralizes native HTML `title` attributes across the app,
 *    preventing Chromium's default OS tooltip from ever showing up.
 * 2. Displays a clean, custom, theme-consistent floating tooltip for `[title]` and `[data-tooltip]`.
 */
export function GlobalTooltip() {
  const [activeTooltip, setActiveTooltip] = useState<TooltipTargetData | null>(null);
  const currentTargetRef = useRef<HTMLElement | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWarmRef = useRef(false);
  const warmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOpenTimer = () => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  };

  const close = () => {
    clearOpenTimer();
    currentTargetRef.current = null;
    setActiveTooltip(null);
    if (warmTimerRef.current) clearTimeout(warmTimerRef.current);
    warmTimerRef.current = setTimeout(() => {
      isWarmRef.current = false;
    }, 350);
  };

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    // Helper to strip title attribute and store in data-tooltip
    const neutralizeElement = (el: HTMLElement) => {
      const raw = el.getAttribute("title");
      if (raw && raw.trim()) {
        const text = raw.trim();
        el.setAttribute("data-tooltip", text);
        if (!el.getAttribute("aria-label")) {
          el.setAttribute("aria-label", text);
        }
        el.removeAttribute("title");
      }
    };

    const neutralizeSubtree = (root: ParentNode) => {
      if ("getAttribute" in root && (root as HTMLElement).hasAttribute("title")) {
        neutralizeElement(root as HTMLElement);
      }
      const elements = root.querySelectorAll<HTMLElement>("[title]");
      for (let i = 0; i < elements.length; i++) {
        neutralizeElement(elements[i]);
      }
    };

    // Strip titles initially
    neutralizeSubtree(document.body);

    // Observe future DOM insertions or title mutations
    const observer = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        if (mutation.type === "childList") {
          for (let j = 0; j < mutation.addedNodes.length; j++) {
            const node = mutation.addedNodes[j];
            if (node.nodeType === Node.ELEMENT_NODE) {
              neutralizeSubtree(node as HTMLElement);
            }
          }
        } else if (mutation.type === "attributes" && mutation.attributeName === "title") {
          const el = mutation.target as HTMLElement;
          if (el.hasAttribute("title")) {
            neutralizeElement(el);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["title"],
    });

    const handlePointerOver = (e: PointerEvent) => {
      const rawTarget = e.target as HTMLElement | null;
      if (!rawTarget) return;

      // Immediately neutralize any title on hover (in case it wasn't stripped yet)
      const targetWithTitle = rawTarget.closest<HTMLElement>("[title]");
      if (targetWithTitle) {
        neutralizeElement(targetWithTitle);
      }

      const target = rawTarget.closest<HTMLElement>("[data-tooltip]");
      if (!target || target.closest("[data-no-tooltip]")) {
        return;
      }

      const tooltipText = target.getAttribute("data-tooltip");
      if (!tooltipText || !tooltipText.trim()) {
        return;
      }

      if (currentTargetRef.current === target) {
        return;
      }

      clearOpenTimer();
      currentTargetRef.current = target;

      const show = () => {
        if (currentTargetRef.current !== target) return;
        const rect = target.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        const preferSide =
          (target.getAttribute("data-tooltip-side") as "top" | "bottom") ||
          (rect.top < 38 ? "bottom" : "top");

        isWarmRef.current = true;
        setActiveTooltip({
          text: tooltipText.trim(),
          targetRect: {
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: rect.height,
          },
          side: preferSide,
        });
      };

      const delay = isWarmRef.current ? 40 : 250;
      openTimerRef.current = setTimeout(show, delay);
    };

    const handlePointerOut = (e: PointerEvent) => {
      const target = currentTargetRef.current;
      if (!target) return;
      const related = e.relatedTarget as Node | null;
      if (related && target.contains(related)) {
        return;
      }
      close();
    };

    const handlePointerDown = () => close();
    const handleScroll = () => close();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("pointerover", handlePointerOver, true);
    document.addEventListener("pointerout", handlePointerOut, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("blur", close);

    return () => {
      observer.disconnect();
      clearOpenTimer();
      if (warmTimerRef.current) clearTimeout(warmTimerRef.current);
      document.removeEventListener("pointerover", handlePointerOver, true);
      document.removeEventListener("pointerout", handlePointerOut, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("blur", close);
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {activeTooltip && <GlobalTooltipPortal key={activeTooltip.text} {...activeTooltip} />}
    </AnimatePresence>,
    document.body
  );
}

export default GlobalTooltip;
