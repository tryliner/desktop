import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

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
            onClick={() => onOpenChange(false)}
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
