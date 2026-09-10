import { useState, useRef, useEffect, memo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "right" | "left" | "top" | "bottom";
  align?: "center" | "start" | "end";
  sideOffset?: number;
  delay?: number;
  className?: string;
  disabled?: boolean;
  multiline?: boolean;
}

function Tooltip({
  content,
  children,
  side = "right",
  align = "center",
  sideOffset = 8,
  delay = 200,
  className = "",
  disabled = false,
  multiline = false,
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // fixed coords from the anchor rect, clamped into the viewport.
  // rendered in a portal so overflow-hidden ancestors (dialogs) can't clip it.
  const open = () => {
    const el = anchorRef.current;
    if (!el || typeof window === "undefined") return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    let top = 0;
    let left = 0;

    if (side === "top" || side === "bottom") {
      left =
        align === "start"
          ? rect.left
          : align === "end"
            ? rect.right
            : rect.left + rect.width / 2;
      left = Math.min(
        Math.max(left, 128 + margin),
        window.innerWidth - 128 - margin,
      );
      const need = rect.height + sideOffset;
      if (side === "top") {
        top = rect.top - sideOffset;
        // flip below if there is no room above
        if (top - need < margin) {
          top = rect.bottom + sideOffset;
        }
      } else {
        top = rect.bottom + sideOffset;
        if (top + need > window.innerHeight - margin) {
          top = rect.top - sideOffset;
        }
      }
    } else {
      top = rect.top + rect.height / 2;
      top = Math.min(Math.max(top, 24), window.innerHeight - 24);
      left = side === "right" ? rect.right + sideOffset : rect.left - sideOffset;
    }

    setPos({ top, left });
    setIsOpen(true);
  };

  const handleMouseEnter = () => {
    if (disabled || !content) return;
    clearTimer();
    timerRef.current = setTimeout(open, delay);
  };

  const handleMouseLeave = () => {
    clearTimer();
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    // anchor may move (scroll/resize) — just dismiss, it reopens on hover
    const dismiss = () => setIsOpen(false);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  const show = isOpen && !disabled && content;

  const transform =
    side === "top"
      ? "translate(-50%, -100%)"
      : side === "bottom"
        ? "translate(-50%, 0)"
        : side === "right"
          ? "translate(0, -50%)"
          : "translate(-100%, -50%)";

  const animOffset =
    side === "top"
      ? { y: 4 }
      : side === "bottom"
        ? { y: -4 }
        : side === "right"
          ? { x: -4 }
          : { x: 4 };

  return (
    <div
      ref={anchorRef}
      className="relative inline-flex items-center justify-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {show && (
              <div
                className="pointer-events-none fixed left-0 top-0 z-[300]"
                style={{ top: pos.top, left: pos.left, transform }}
              >
                <motion.div
                  role="tooltip"
                  initial={{ opacity: 0, ...animOffset }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, ...animOffset }}
                  transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                  className={`rounded-md border border-border-primary bg-bg-elevated px-3 py-2 text-[13px] font-medium text-text-primary antialiased select-none shadow-lg ${
                    multiline
                      ? "whitespace-normal min-w-[180px] max-w-[240px] leading-snug"
                      : "whitespace-nowrap leading-none"
                  } ${className}`}
                  style={{
                    fontFamily: "var(--font-inter), sans-serif",
                    WebkitFontSmoothing: "antialiased",
                    MozOsxFontSmoothing: "grayscale",
                    textRendering: "optimizeLegibility",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    willChange: "transform, opacity",
                  }}
                >
                  {content}
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

export default memo(Tooltip);
