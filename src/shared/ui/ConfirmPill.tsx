import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/shared/lib";
import { SMOOTH_EASE as EASE } from "@/shared/hooks/useTweenedNumber";

const DISARM_AFTER_MS = 3000;
const SETTLED_SPEED_PX_PER_MS = 0.25;
const STOPPED_AFTER_MS = 50;

type Mode = "idle" | "hover" | "armed";

const MODE_CLASSES: Record<Mode, string> = {
  idle: "bg-fill text-text-secondary",
  hover: "bg-[#ff3b30]/[0.12] text-[#ff3b30] dark:text-[#ff453a]",
  armed: "bg-[#ff3b30] text-white dark:bg-[#ff453a]",
};

export interface ConfirmPillProps {
  /** what the pill shows at rest (a size, a state) */
  label: string;
  /** shown on hover, tinted red: what a click would do */
  actionLabel: string;
  /** shown after the first click; the second click runs onConfirm */
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Two-step destructive action in one pill: hover names the action, the first
 * click arms it, the second confirms. Disarms by itself after 3s or when the
 * pointer leaves.
 */
export default function ConfirmPill({
  label,
  actionLabel,
  confirmLabel,
  onConfirm,
  disabled = false,
  className,
}: ConfirmPillProps) {
  const [hovered, setHovered] = useState(false);
  const [armed, setArmed] = useState(false);

  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMove = useRef({ x: 0, y: 0, t: 0 });

  const cancelIntent = () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
  };

  const settle = () => {
    cancelIntent();
    setHovered(true);
  };

  const track = (x: number, y: number, t: number) => {
    lastMove.current = { x, y, t };
    cancelIntent();
    stopTimer.current = setTimeout(settle, STOPPED_AFTER_MS);
  };

  useEffect(() => cancelIntent, []);

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
  const shown =
    mode === "armed" ? confirmLabel : mode === "hover" ? actionLabel : label;

  const [swap, setSwap] = useState({ mode, key: 0 });
  if (swap.mode !== mode) setSwap({ mode, key: swap.key + 1 });

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={disabled ? label : armed ? confirmLabel : actionLabel}
      onPointerEnter={(event) =>
        track(event.clientX, event.clientY, event.timeStamp)
      }
      onPointerMove={(event) => {
        if (hovered) return;
        const last = lastMove.current;
        const speed =
          Math.hypot(event.clientX - last.x, event.clientY - last.y) /
          Math.max(event.timeStamp - last.t, 1);
        if (speed < SETTLED_SPEED_PX_PER_MS) {
          settle();
          return;
        }
        track(event.clientX, event.clientY, event.timeStamp);
      }}
      onPointerLeave={() => {
        cancelIntent();
        setHovered(false);
        setArmed(false);
      }}
      onClick={() => {
        cancelIntent();
        setHovered(true);
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
      className={cn(
        "grid h-[30px] shrink-0 place-items-center overflow-hidden rounded-full border-0 px-[12px] text-body font-[500] tabular-nums whitespace-nowrap transition-colors duration-300",
        disabled ? "cursor-default" : "cursor-pointer",
        MODE_CLASSES[mode],
        className,
      )}
    >
      {[label, actionLabel, ...(armed ? [confirmLabel] : [])].map(
        (text, index) => (
          <span
            key={index}
            aria-hidden
            className="invisible col-start-1 row-start-1"
          >
            {text}
          </span>
        ),
      )}
      <AnimatePresence initial={false}>
        <motion.span
          key={swap.key}
          className="col-start-1 row-start-1"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{
            y: "-100%",
            opacity: 0,
            transition: {
              duration: 0.28,
              ease: EASE,
              opacity: { duration: 0.12 },
            },
          }}
          transition={{ duration: 0.28, ease: EASE }}
        >
          {shown}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
