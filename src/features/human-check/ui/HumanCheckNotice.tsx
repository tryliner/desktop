import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { useHumanCheckStore } from "../store/humanCheckStore";
import CheckFrame from "./CheckFrame";
import ShieldBadge from "./ShieldBadge";

const buttonBase =
  "h-[40px] flex-1 rounded-[12px] px-[18px] text-[14.5px] font-[500] transition-colors";

export default function HumanCheckNotice() {
  const { t } = useTranslation();
  const request = useHumanCheckStore((state) => state.request);
  const phase = useHumanCheckStore((state) => state.phase);
  const attempt = useHumanCheckStore((state) => state.attempt);
  const retry = useHumanCheckStore((state) => state.retry);
  const cancel = useHumanCheckStore((state) => state.cancel);
  const failed = phase === "error";

  useEffect(() => {
    if (!request) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request, cancel]);

  if (typeof document === "undefined") return null;

  const description =
    phase === "expired"
      ? t("human_check.expired")
      : failed
        ? t("human_check.failed")
        : t("human_check.description");

  return createPortal(
    <AnimatePresence>
      {request && (
        <motion.div
          role="dialog"
          aria-live="polite"
          data-no-window-drag
          initial={{ opacity: 0, y: -16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className={cn(
            "fixed left-1/2 top-[44px] z-[9998] -translate-x-1/2",
            "flex w-[356px] max-w-[calc(100vw-24px)] flex-col p-[18px]",
            "rounded-[26px] bg-bg-elevated/55 shadow-[0_24px_80px_rgba(0,0,0,0.35)]",
            "backdrop-blur-[40px] backdrop-saturate-150",
          )}
        >
          <div className="flex items-start gap-[14px]">
            <ShieldBadge />
            <div className="flex min-w-0 flex-col">
              <h2 className="text-[16px] font-[600] leading-[1.25] tracking-[-0.01em] text-text-primary">
                {t("human_check.title")}
              </h2>
              <p className="mt-[5px] text-[13px] leading-[1.4] text-text-secondary">
                {description}
              </p>
            </div>
          </div>
          <div className="mt-[12px]">
            <CheckFrame action={request.action} attempt={attempt} />
          </div>
          <div className="mt-[10px] flex gap-[8px]">
            <button
              type="button"
              disabled={!failed}
              onClick={failed ? retry : undefined}
              className={cn(
                buttonBase,
                "bg-text-primary/75 text-bg-primary/80",
                failed ? "hover:bg-text-primary/90" : "cursor-default",
              )}
            >
              {failed ? t("human_check.retry") : t("human_check.waiting")}
            </button>
            <button
              type="button"
              onClick={cancel}
              className={cn(
                buttonBase,
                "bg-black/[0.06] text-text-primary hover:bg-black/[0.1]",
                "dark:bg-white/[0.1] dark:hover:bg-white/[0.15]",
              )}
            >
              {request.mode === "optional"
                ? t("human_check.skip")
                : t("human_check.cancel")}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
