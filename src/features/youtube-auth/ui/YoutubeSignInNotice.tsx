import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { useYoutubeSignInStore } from "../store/youtubeSignInStore";
import { useYoutubeSignInPrompt } from "../hooks/useYoutubeSignInPrompt";
import ActivationPanel from "./ActivationPanel";
import TrackBadge from "./TrackBadge";
import LogoPattern from "./LogoPattern";

const buttonBase =
  "h-[40px] shrink-0 rounded-[12px] px-[18px] text-[14.5px] font-[500] transition-colors";

export default function YoutubeSignInNotice() {
  useYoutubeSignInPrompt();
  const { t } = useTranslation();
  const open = useYoutubeSignInStore((state) => state.open);
  const phase = useYoutubeSignInStore((state) => state.phase);
  const code = useYoutubeSignInStore((state) => state.code);
  const dismiss = useYoutubeSignInStore((state) => state.dismiss);
  const retry = useYoutubeSignInStore((state) => state.retry);
  const failed = phase === "error";

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
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
            "flex w-[600px] max-w-[calc(100vw-24px)] items-stretch gap-[20px] overflow-hidden p-[18px]",
            "rounded-[26px] bg-bg-elevated/55 shadow-[0_24px_80px_rgba(0,0,0,0.35)]",
            "backdrop-blur-[40px] backdrop-saturate-150",
          )}
        >
          <LogoPattern />
          <div className="relative flex min-w-0 flex-1 flex-col">
            <TrackBadge />
            <h2 className="mt-[14px] text-[18px] font-[600] leading-[1.25] tracking-[-0.01em] text-text-primary">
              {t("youtube_auth.title") ||
                "Sign in to YouTube to keep listening"}
            </h2>
            <p className="mt-[8px] text-[14px] leading-[1.45] text-text-secondary">
              {t("youtube_auth.description") ||
                "YouTube blocks audio streams without sign-in (BotGuard check). Signing in with your Google/YouTube account confirms you are a real listener and lifts the limits."}
            </p>
            <div className="mt-[16px] flex flex-wrap gap-[8px]">
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
                {failed
                  ? t("youtube_auth.retry") || "Try again"
                  : t("youtube_auth.waiting") || "Waiting for sign-in…"}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className={cn(
                  buttonBase,
                  "bg-black/[0.06] text-text-primary hover:bg-black/[0.1]",
                  "dark:bg-white/[0.1] dark:hover:bg-white/[0.15]",
                )}
              >
                {t("youtube_auth.not_now") || "Not now"}
              </button>
            </div>
          </div>
          <ActivationPanel code={code} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
