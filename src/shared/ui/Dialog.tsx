import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { isWindowDraggingActive } from "@/shared/hooks";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  maxWidth?: number | string;
  minHeight?: number | string;
  maxHeight?: number | string;
  className?: string;
}

export default function Dialog({
  open,
  onOpenChange,
  children,
  maxWidth = 360,
  minHeight,
  maxHeight,
  className = "",
}: DialogProps) {
  const [mounted, setMounted] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number; target: EventTarget | null } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!mounted || typeof document === "undefined") return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      target: e.target,
    };
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isWindowDraggingActive()) {
      return;
    }
    const start = pointerStartRef.current;
    if (start) {
      const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (dist > 6) {
        return;
      }
      if (start.target !== e.currentTarget && (start.target as HTMLElement)?.closest?.("[data-dialog-container]")) {
        return;
      }
    }
    onOpenChange(false);
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="dialog-backdrop"
            data-dialog-backdrop="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[199] bg-black/40 backdrop-blur-[2px] rounded-4xl overflow-hidden"
            onPointerDown={handlePointerDown}
            onClick={handleBackdropClick}
          />
          <motion.div
            key="dialog"
            data-dialog-container="true"
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
          >
            <div
              className={`pointer-events-auto w-full mx-[16px] max-h-[85vh] flex flex-col rounded-xl border border-border-primary bg-bg-primary overflow-hidden relative ${
                className || "pt-[16px]"
              }`}
              style={{ maxWidth, minHeight, ...(maxHeight ? { maxHeight } : {}) }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
