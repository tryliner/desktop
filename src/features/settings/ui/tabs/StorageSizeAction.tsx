import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/shared/lib";
import { formatStorageBytes } from "@/shared/utils/cacheManager";
import { SMOOTH_EASE, useTweenedNumber } from "./StorageOverview";

const DISARM_AFTER_MS = 3000;
const PADDING_X = 24;

type Mode = "idle" | "hover" | "armed";

const MODE_CLASSES: Record<Mode, string> = {
  idle: "bg-black/[0.05] text-text-secondary dark:bg-white/[0.07]",
  hover: "bg-[#ff3b30]/[0.12] text-[#ff3b30] dark:text-[#ff453a]",
  armed: "bg-[#ff3b30] text-white dark:bg-[#ff453a]",
};

export function StorageSizeAction({
  bytes,
  actionLabel,
  confirmLabel,
  onConfirm,
  disabled = false,
}: {
  bytes: number;
  actionLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [armed, setArmed] = useState(false);
  const tweened = useTweenedNumber(bytes);
  const size = formatStorageBytes(Math.round(tweened));

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), DISARM_AFTER_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  const mode: Mode = disabled
    ? "idle"
    : armed
      ? "armed"
      : hovered
        ? "hover"
        : "idle";
  const label =
    mode === "armed" ? confirmLabel : mode === "hover" ? actionLabel : size;

  const measureRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (measureRef.current) {
      setWidth(Math.ceil(measureRef.current.offsetWidth) + PADDING_X);
    }
  }, [label]);

  return (
    <motion.button
      type="button"
      disabled={disabled}
      aria-label={disabled ? size : armed ? confirmLabel : actionLabel}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const stillInside =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom;
        if (stillInside) return;
        setHovered(false);
        setArmed(false);
      }}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
      initial={false}
      animate={width === null ? undefined : { width }}
      transition={{ duration: 0.35, ease: SMOOTH_EASE }}
      className={cn(
        "relative flex h-[30px] shrink-0 items-center justify-center overflow-hidden rounded-full border-0 px-[12px] text-[13px] font-[500] tabular-nums whitespace-nowrap transition-colors duration-300",
        disabled ? "cursor-default" : "cursor-pointer",
        MODE_CLASSES[mode],
      )}
    >
      <span
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute whitespace-nowrap"
      >
        {label}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={mode}
          className="whitespace-nowrap"
          initial={{ y: 12, opacity: 0, filter: "blur(2px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ y: -12, opacity: 0, filter: "blur(2px)" }}
          transition={{ duration: 0.28, ease: SMOOTH_EASE }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
