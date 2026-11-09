import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/shared/lib";
import { SMOOTH_EASE as EASE } from "@/shared/hooks/useTweenedNumber";

const DISARM_AFTER_MS = 3000;
const PADDING_X = 24;

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

  const labelRef = useRef<HTMLSpanElement>(null);
  const actionRef = useRef<HTMLSpanElement>(null);
  const confirmRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const measure = (node: HTMLSpanElement | null) =>
      node ? Math.ceil(node.offsetWidth) : 0;
    const rest = Math.max(
      measure(labelRef.current),
      measure(actionRef.current),
    );
    const next =
      (mode === "armed" ? Math.max(rest, measure(confirmRef.current)) : rest) +
      PADDING_X;
    setWidth((current) => (current === next ? current : next));
  }, [label, actionLabel, confirmLabel, mode]);

  return (
    <motion.button
      type="button"
      disabled={disabled}
      aria-label={disabled ? label : armed ? confirmLabel : actionLabel}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
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
      transition={{ duration: 0.35, ease: EASE }}
      className={cn(
        "relative flex h-[30px] shrink-0 items-center justify-center overflow-hidden rounded-full border-0 px-[12px] text-body font-[500] tabular-nums whitespace-nowrap transition-colors duration-300",
        disabled ? "cursor-default" : "cursor-pointer",
        MODE_CLASSES[mode],
        className,
      )}
    >
      {(
        [
          [labelRef, label],
          [actionRef, actionLabel],
          [confirmRef, confirmLabel],
        ] as const
      ).map(([ref, text], index) => (
        <span
          key={index}
          ref={ref}
          aria-hidden
          className="pointer-events-none invisible absolute whitespace-nowrap"
        >
          {text}
        </span>
      ))}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={swap.key}
          className="whitespace-nowrap"
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
    </motion.button>
  );
}
