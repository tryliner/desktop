import { useState, useRef, useEffect, memo, type ReactNode } from "react";
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
}

function Tooltip({
  content,
  children,
  side = "right",
  sideOffset = 8,
  delay = 200,
  className = "",
  disabled = false,
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    if (disabled || !content) return;
    clearTimer();
    timerRef.current = setTimeout(() => {
      setIsOpen(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    clearTimer();
    setIsOpen(false);
  };

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  const getPositionStyles = (): React.CSSProperties => {
    switch (side) {
      case "right":
        return {
          left: `calc(100% + ${sideOffset}px)`,
          top: "50%",
        };
      case "left":
        return {
          right: `calc(100% + ${sideOffset}px)`,
          top: "50%",
        };
      case "top":
        return {
          bottom: `calc(100% + ${sideOffset}px)`,
          left: "50%",
        };
      case "bottom":
        return {
          top: `calc(100% + ${sideOffset}px)`,
          left: "50%",
        };
    }
  };

  const getAnimationVariants = () => {
    switch (side) {
      case "right":
        return {
          initial: { opacity: 0, x: -6, y: "-50%" },
          animate: { opacity: 1, x: 0, y: "-50%" },
          exit: { opacity: 0, x: -3, y: "-50%" },
        };
      case "left":
        return {
          initial: { opacity: 0, x: 6, y: "-50%" },
          animate: { opacity: 1, x: 0, y: "-50%" },
          exit: { opacity: 0, x: 3, y: "-50%" },
        };
      case "top":
        return {
          initial: { opacity: 0, x: "-50%", y: 6 },
          animate: { opacity: 1, x: "-50%", y: 0 },
          exit: { opacity: 0, x: "-50%", y: 3 },
        };
      case "bottom":
        return {
          initial: { opacity: 0, x: "-50%", y: -6 },
          animate: { opacity: 1, x: "-50%", y: 0 },
          exit: { opacity: 0, x: "-50%", y: -3 },
        };
    }
  };

  const posStyle = getPositionStyles();
  const anim = getAnimationVariants();

  return (
    <div
      className="relative inline-flex items-center justify-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      <AnimatePresence>
        {isOpen && !disabled && content && (
          <motion.div
            role="tooltip"
            initial={anim.initial}
            animate={anim.animate}
            exit={anim.exit}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-sm bg-bg-elevated px-3 py-2 text-[13px] font-medium leading-none text-text-primary antialiased select-none ${className}`}
            style={{
              ...posStyle,
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
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(Tooltip);