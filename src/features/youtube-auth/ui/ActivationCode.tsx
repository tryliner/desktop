import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckLine, CopyLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";

export interface ActivationCodeProps {
  code: string | null;
}

const COPIED_RESET_MS = 1600;

export default function ActivationCode({ code }: ActivationCodeProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    if (!code) return;
    void navigator.clipboard
      .writeText(code)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  const Icon = copied ? CheckLine : CopyLine;

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!code}
      aria-label={t("youtube_auth.copy_code") || "Copy code"}
      className={cn(
        "flex h-[32px] w-full shrink-0 items-center justify-center gap-[6px] rounded-[9px] px-[10px] whitespace-nowrap",
        "bg-black/[0.12] hover:bg-black/[0.16] dark:bg-black/45 dark:hover:bg-black/55",
        "text-[12.5px] font-[700] tracking-[0.01em] text-text-primary transition-colors",
        "disabled:cursor-default",
      )}
    >
      {code ? (
        <motion.span
          key={code}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex items-center gap-[6px]"
        >
          <span className="tabular-nums">{code}</span>
          <span className="relative size-[14px] shrink-0 opacity-70">
            <AnimatePresence initial={false}>
              <motion.span
                key={copied ? "copied" : "copy"}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute inset-0"
              >
                <Icon size={14} />
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.span>
      ) : (
        <span className="h-[10px] w-[86px] animate-pulse rounded-full bg-black/[0.1] dark:bg-white/[0.14]" />
      )}
    </button>
  );
}
