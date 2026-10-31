import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FolderOpenLine } from "@mingcute/react";
import { cn } from "@/shared/lib";
import { SMOOTH_EASE } from "./StorageOverview";

const ICON_SIZE = 28;
const PADDING_LEFT = 10;
const PADDING_RIGHT = 4;

export function StorageFolderButton({
  label,
  onOpen,
}: {
  label: string;
  onOpen: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [labelWidth, setLabelWidth] = useState(0);

  useLayoutEffect(() => {
    if (measureRef.current) {
      setLabelWidth(Math.ceil(measureRef.current.offsetWidth));
    }
  }, [label]);

  const width = hovered
    ? PADDING_LEFT + labelWidth + ICON_SIZE + PADDING_RIGHT
    : ICON_SIZE + PADDING_RIGHT;

  return (
    <motion.button
      type="button"
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={onOpen}
      initial={false}
      animate={{ width }}
      transition={{ duration: 0.4, ease: SMOOTH_EASE }}
      className={cn(
        "relative flex h-[28px] shrink-0 cursor-pointer items-center justify-end overflow-hidden rounded-full border-0 text-[12px] font-[500] transition-colors duration-300",
        hovered
          ? "bg-black/[0.05] text-text-primary dark:bg-white/[0.07]"
          : "bg-transparent text-text-tertiary",
      )}
      style={{
        paddingLeft: hovered ? PADDING_LEFT : 0,
        paddingRight: PADDING_RIGHT,
      }}
    >
      <span
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute whitespace-nowrap"
      >
        {label}
      </span>
      <AnimatePresence initial={false}>
        {hovered ? (
          <motion.span
            key="label"
            className="whitespace-nowrap"
            initial={{ x: 8, opacity: 0, filter: "blur(3px)" }}
            animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ x: 8, opacity: 0, filter: "blur(3px)" }}
            transition={{ duration: 0.3, ease: SMOOTH_EASE }}
          >
            {label}
          </motion.span>
        ) : null}
      </AnimatePresence>
      <span
        className="flex shrink-0 items-center justify-center"
        style={{ width: ICON_SIZE, height: ICON_SIZE }}
      >
        <FolderOpenLine size={16} />
      </span>
    </motion.button>
  );
}
