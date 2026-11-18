import { AnimatePresence, motion } from "framer-motion";
import { LuHeart, LuListPlus, LuPlus, LuX } from "react-icons/lu";
import { ConfirmPill } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import {
  selectionActions,
  useSelectionSummary,
} from "../hooks/useSelectionActions";

const ACTION_CLASS =
  "inline-flex h-[34px] shrink-0 items-center gap-[7px] whitespace-nowrap rounded-[9px] border-0 bg-transparent px-[12px] text-label font-[500] text-text-primary cursor-pointer transition-[background-color,transform] duration-150 hover:bg-fill active:scale-[0.97] disabled:cursor-default disabled:opacity-40";

/**
 * Floating bar for a multi-selection in any track list. It appears with the
 * first Ctrl/Cmd/Shift-click and goes away on Escape, a plain click or
 * leaving the page.
 */
export function SelectionActionBar() {
  const { t } = useTranslation();
  const summary = useSelectionSummary();
  const allLocal = summary.count > 0 && summary.localCount === summary.count;

  return (
    <div className="pointer-events-none fixed bottom-[104px] left-1/2 z-[65] -translate-x-1/2">
      <AnimatePresence>
        {summary.count > 0 && (
          <motion.div
            key="selection-bar"
            role="toolbar"
            aria-label={t("selection.count", { count: summary.count })}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
            className="pointer-events-auto flex items-center gap-[2px] rounded-[14px] bg-bg-glass p-[5px] shadow-[0_8px_32px_rgba(0,0,0,0.28)] backdrop-blur-[48px] select-none"
            // keep clicks here from reaching the list underneath (which clears)
            onClick={(e) => e.stopPropagation()}
          >
            <span className="whitespace-nowrap px-[10px] text-label font-[600] tabular-nums text-text-primary">
              {t("selection.count", { count: summary.count })}
            </span>
            <span className="mx-[2px] h-[18px] w-px bg-border-alpha-14" />
            <button
              type="button"
              className={ACTION_CLASS}
              disabled={allLocal}
              onClick={() => selectionActions.addToPlaylist(t)}
            >
              <LuPlus size={15} />
              {t("selection.add_to_playlist")}
            </button>
            <button
              type="button"
              className={ACTION_CLASS}
              onClick={() => selectionActions.addToQueue(t)}
            >
              <LuListPlus size={15} />
              {t("selection.add_to_queue")}
            </button>
            <button
              type="button"
              className={ACTION_CLASS}
              disabled={allLocal}
              onClick={() => selectionActions.likeAll(t)}
            >
              <LuHeart size={15} />
              {t("selection.like")}
            </button>
            {summary.canRemove && (
              <ConfirmPill
                label={t("selection.remove")}
                actionLabel={t("selection.remove")}
                confirmLabel={t("selection.remove_confirm", {
                  count: summary.count,
                })}
                onConfirm={() => void selectionActions.removeFromPlaylist(t)}
                className="!h-[34px]"
              />
            )}
            <button
              type="button"
              aria-label={t("selection.clear")}
              title={t("selection.clear")}
              className={cn(ACTION_CLASS, "w-[34px] justify-center !px-0")}
              onClick={selectionActions.clear}
            >
              <LuX size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
