import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckFill, Magic2Fill, WarningFill } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { cn, isWeakDevice } from "@/shared/lib";
import { useFrameStrain } from "../hooks/useFrameStrain";
import { VISUAL_MODES, useVisualModeStore } from "../store/visualModeStore";

interface BetaVisualsWarningProps {
  docked: boolean;
}

export function BetaVisualsWarning({ docked }: BetaVisualsWarningProps) {
  const { t } = useTranslation();
  const mode = useVisualModeStore((s) => s.mode);
  const setMode = useVisualModeStore((s) => s.setMode);
  const ambientAvailable = useVisualModeStore((s) => s.ambientAvailable);
  const fullMode = mode === "full";
  const strained = useFrameStrain(fullMode);
  const warning = fullMode && (ambientAvailable || strained || isWeakDevice());
  const Icon = warning ? WarningFill : Magic2Fill;
  const copy = ambientAvailable ? "ambient" : "settings";
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex pointer-events-auto select-none",
        docked ? "absolute right-full top-0 mr-[6px]" : "relative ml-[4px]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={t("player.beta_visuals.label")}
        className={cn(
          "group inline-flex h-[26px] min-w-[26px] cursor-pointer items-center justify-center rounded-md border-none bg-transparent px-[5px] transition-colors duration-300 hover:bg-white/10",
          warning ? "text-yellow-400" : "text-white/70 hover:text-white",
        )}
      >
        {warning && (
          <span className="grid grid-cols-[0fr] transition-[grid-template-columns] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:grid-cols-[1fr]">
            <span className="min-w-0 overflow-hidden">
              <span className="block whitespace-nowrap pr-[6px] text-[12px] font-[600] opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-hover:delay-[120ms] group-hover:duration-300">
                {t("player.beta_visuals.label")}
              </span>
            </span>
          </span>
        )}
        <Icon size={16} className="shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            initial={{ opacity: 0, y: -10, scale: 0.94 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: 0.42, ease: [0.32, 0.72, 0, 1] },
            }}
            exit={{
              opacity: 0,
              y: -6,
              scale: 0.97,
              transition: { duration: 0.24, ease: [0.4, 0, 0.2, 1] },
            }}
            className={cn(
              "absolute right-0 top-full z-50 mt-[6px] flex w-[268px] origin-top-right flex-col p-[11px]",
              "rounded-[16px] bg-bg-elevated/55 shadow-[0_14px_48px_rgba(0,0,0,0.35)]",
              "backdrop-blur-[40px] backdrop-saturate-150",
            )}
          >
            <div className="flex items-center gap-[6px] text-[13px] font-[600] leading-[1.25] tracking-[-0.01em] text-text-primary">
              <Icon
                size={14}
                className={cn("shrink-0", warning && "text-yellow-400")}
              />
              {t(`player.beta_visuals.${copy}_title`)}
            </div>
            <p className="mt-[4px] mb-0 text-[11.5px] leading-[1.4] text-text-secondary">
              {t(`player.beta_visuals.${copy}_body`)}
            </p>
            <div className="mt-[9px] flex flex-col gap-[4px]">
              {VISUAL_MODES.map((option) => {
                const active = option === mode;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMode(option)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-[8px] rounded-[10px] border-none px-[10px] py-[6px] text-left transition-colors",
                      active
                        ? "bg-text-primary/75 text-bg-primary/90"
                        : "bg-black/[0.06] text-text-primary hover:bg-black/[0.1] dark:bg-white/[0.1] dark:hover:bg-white/[0.15]",
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[12.5px] font-[600]">
                        {t(`player.beta_visuals.modes.${option}.name`)}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] leading-[1.3]",
                          active ? "opacity-75" : "text-text-secondary",
                        )}
                      >
                        {t(`player.beta_visuals.modes.${option}.hint`)}
                      </span>
                    </span>
                    {active && <CheckFill size={14} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
