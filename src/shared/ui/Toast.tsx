import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "@/languages";
import { api } from "@/shared/api";
import { useImportStore } from "@/features/library/store/importStore";
import { useModalStore } from "@/features/library/store/modalStore";
import ScrollableText from "./ScrollableText";

type ToastVariant = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

export interface ToastOptions {
  id?: string | number;
  duration?: number;
  description?: string;
  requestId?: string;
  errorCode?: string;
  action?: ToastAction;
  onDismiss?: () => void;
}

interface Toast {
  id: string | number;
  message: string;
  variant: ToastVariant;
  duration: number;
  description?: string;
  requestId?: string;
  errorCode?: string;
  action?: ToastAction;
  onDismiss?: () => void;
}

interface ToastContextValue {
  toast: (
    message: string,
    variant?: ToastVariant,
    options?: ToastOptions,
  ) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function showToast(
  message: string,
  variant: ToastVariant = "info",
  options?: ToastOptions,
) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("liner:toast", {
        detail: { message, variant, options },
      }),
    );
  }
}

const DURATION = 3500;

const variantAccent: Record<ToastVariant, string> = {
  success: "#34A853",
  error: "#EA4335",
  info: "#4285F4",
};

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}


function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function useSafeTranslation() {
  try {
    return useTranslation();
  } catch {
    return {
      t: (key: string, params?: Record<string, string | number>) => {
        let text = key;
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            text = text.replace(`{${k}}`, String(v));
          }
        }
        return text;
      },
    };
  }
}

export { ScrollableText };

function ImportToastItem() {
  const { t } = useSafeTranslation();
  const navigate = useNavigate();
  const job = useImportStore((state) => state.job);
  const reset = useImportStore((state) => state.reset);
  const openImportReview = useModalStore((state) => state.openImportReview);
  const isReviewOpen = useModalStore((state) => state.importReviewOpen);

  const [dismissedQueuedId, setDismissedQueuedId] = useState<string | null>(null);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [openingReview, setOpeningReview] = useState(false);

  const handleOpenReview = async () => {
    if (!job || openingReview) return;
    setOpeningReview(true);
    try {
      const res = await api.getPlaylistImportReview(job.id);
      openImportReview(job.id, res.items);
    } catch {
      openImportReview(job.id);
    } finally {
      setOpeningReview(false);
    }
  };

  useEffect(() => {
    if (!job) return;
    if (job.status === "queued") {
      const timer = setTimeout(() => {
        setDismissedQueuedId(job.id);
      }, 3500);
      return () => clearTimeout(timer);
    }
    if (job.status === "completed" || job.status === "failed") {
      const timer = setTimeout(() => {
        reset();
      }, job.status === "completed" ? 5000 : 7000);
      return () => clearTimeout(timer);
    }
  }, [job?.id, job?.status, reset]);

  const shouldShow =
    Boolean(job) &&
    !(job?.status === "queued" && dismissedQueuedId === job.id) &&
    !(job?.status === "awaiting_decision" && isReviewOpen);

  const isQueued = job?.status === "queued";
  const isRunning = job?.status === "running";
  const isAwaiting = job?.status === "awaiting_decision";
  const isFinalizing = job?.status === "finalizing";
  const isCompleted = job?.status === "completed";
  const isFailed = job?.status === "failed";

  const getSubtitle = () => {
    if (!job) return "";
    if (isFailed) return job.error?.message || t("import.status_failed");
    if (isQueued) return t("import.status_queued_sub");
    if (isRunning) {
      if (job.result?.total) {
        return t("import.status_running_progress", {
          count: job.result.imported ?? 0,
          total: job.result.total,
        });
      }
      return t("import.status_searching_sub");
    }
    if (isAwaiting) return t("import.status_awaiting_sub");
    if (isFinalizing) return t("import.status_finalizing_sub");
    if (isCompleted) {
      if (job.result?.imported) {
        return t("import.status_completed_sub", { count: job.result.imported });
      }
      return t("import.status_completed_sub_empty");
    }
    return "";
  };

  const getTitle = () => {
    if (isQueued) return t("import.status_queued");
    if (isRunning) return t("import.status_running");
    if (isAwaiting) return t("import.status_awaiting_decision");
    if (isFinalizing) return t("import.status_finalizing");
    if (isCompleted) return t("import.status_completed");
    return t("import.status_failed");
  };

  return (
    <AnimatePresence mode="popLayout">
      {shouldShow && job && (
        <motion.div
          key={`${job.id}-${job.status}`}
          layout
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onMouseEnter={() => setIsCardHovered(true)}
          onMouseLeave={() => setIsCardHovered(false)}
          className="pointer-events-auto flex items-center justify-between gap-[12px] rounded-xl border border-border-primary bg-bg-elevated shadow-2xl px-[16px] py-[12px] min-w-[280px] max-w-[380px]"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          <div className="flex items-center gap-[10px] min-w-0 flex-1">
            <span
              className="flex items-center justify-center shrink-0"
              style={{
                color: (isCompleted || isQueued)
                  ? "#34A853"
                  : isFailed
                    ? "#EA4335"
                    : "#4285F4",
              }}
            >
              {isRunning || isFinalizing ? (
                <SpinnerIcon />
              ) : isAwaiting ? (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4285F4] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#4285F4]"></span>
                </span>
              ) : (isCompleted || isQueued) ? (
                <CheckIcon />
              ) : (
                <ErrorIcon />
              )}
            </span>

            <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
              <ScrollableText
                text={getTitle()}
                className="text-text-primary text-[13px] font-[500]"
                isParentHovered={isCardHovered}
              />
              <ScrollableText
                text={getSubtitle()}
                className="text-text-tertiary text-[11px]"
                isParentHovered={isCardHovered}
              />
            </div>
          </div>

          <div className="flex items-center gap-[6px] shrink-0">
            {isAwaiting && (
              <button
                type="button"
                disabled={openingReview}
                onClick={() => void handleOpenReview()}
                className="relative inline-flex items-center justify-center px-[10px] py-[5px] rounded-lg text-[12px] font-[500] bg-btn-primary-bg text-btn-primary-text hover:opacity-90 active:scale-[0.96] transition-all border-0 cursor-pointer shadow-sm disabled:pointer-events-none"
              >
                <span
                  className={`transition-opacity duration-200 ${openingReview ? "opacity-0" : "opacity-100"}`}
                >
                  {t("import.review_action")}
                </span>
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${openingReview ? "opacity-100" : "opacity-0"}`}
                >
                  <SpinnerIcon />
                </span>
              </button>
            )}

            {isCompleted && job.playlistId && (
              <button
                type="button"
                onClick={() => {
                  navigate(`/library/playlist?id=${encodeURIComponent(job.playlistId!)}`);
                  reset();
                }}
                className="inline-flex items-center gap-[4px] px-[10px] py-[5px] rounded-lg text-[12px] font-[500] bg-btn-primary-bg text-btn-primary-text hover:opacity-90 active:scale-[0.96] transition-all border-0 cursor-pointer shadow-sm"
              >
                <ExternalLinkIcon />
                <span>{t("import.view_playlist")}</span>
              </button>
            )}

            {(isCompleted || isFailed) && (
              <button
                type="button"
                onClick={reset}
                aria-label={t("common.close")}
                className="inline-flex items-center justify-center h-[24px] w-[24px] rounded-md text-text-tertiary hover:text-text-primary hover:bg-border-alpha-14 transition-colors border-0 bg-transparent cursor-pointer"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: string | number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (
      message: string,
      variant: ToastVariant = "info",
      options?: ToastOptions,
    ) => {
      const id = options?.id ?? ++idRef.current;
      const duration = options?.duration ?? DURATION;

      setToasts((current) => {
        const idx = current.findIndex((t) => t.id === id);
        const item: Toast = {
          id,
          message,
          variant,
          duration,
          description: options?.description,
          requestId: options?.requestId,
          errorCode: options?.errorCode,
          action: options?.action,
          onDismiss: options?.onDismiss,
        };
        if (idx >= 0) {
          const next = [...current];
          next[idx] = item;
          return next;
        }
        return [...current, item];
      });
    },
    [],
  );

  useEffect(() => {
    const handleCustomToast = (e: Event) => {
      const detail = (e as CustomEvent<{
        message: string;
        variant?: ToastVariant;
        options?: ToastOptions;
      }>).detail;
      if (detail && detail.message) {
        toast(detail.message, detail.variant, detail.options);
      }
    };
    window.addEventListener("liner:toast", handleCustomToast);
    return () => window.removeEventListener("liner:toast", handleCustomToast);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-[20px] right-[20px] z-[9999] flex flex-col gap-[10px] pointer-events-none max-w-[420px]">
        <ImportToastItem />
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyRequestId = (reqId: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(reqId).catch(() => {});
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2200);
    }
  };

  useEffect(() => {
    let removeTimer: any;

    if (toast.duration && toast.duration < 999999) {
      removeTimer = setTimeout(onDismiss, toast.duration);
    }

    return () => {
      if (removeTimer) clearTimeout(removeTimer);
    };
  }, [onDismiss, toast.duration]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
      className="pointer-events-auto flex items-center justify-between gap-[10px] rounded-xl border border-border-primary bg-bg-elevated px-[16px] py-[12px] shadow-lg max-w-[380px]"
      style={{ fontFamily: "var(--font-inter), sans-serif" }}
    >
      <div className="flex items-center gap-[10px] min-w-0 flex-1">
        <span
          className="flex items-center justify-center shrink-0"
          style={{ color: variantAccent[toast.variant] }}
        >
          {toast.variant === "success" && <CheckIcon />}
          {toast.variant === "error" && <ErrorIcon />}
          {toast.variant === "info" && <SpinnerIcon />}
        </span>
        <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
          <ScrollableText
            text={toast.message}
            className="text-text-primary text-[14px]"
            style={{ fontWeight: 350 }}
            isParentHovered={isCardHovered}
          />
          {toast.description && (
            <ScrollableText
              text={toast.description}
              className="text-text-tertiary text-[12px]"
              isParentHovered={isCardHovered}
            />
          )}
          {toast.requestId && (
            <div className="mt-[4px] flex items-center gap-[6px]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyRequestId(toast.requestId!);
                }}
                className="inline-flex items-center gap-[4px] px-[6px] py-[2px] rounded text-[11px] font-mono bg-border-alpha-14 hover:bg-border-alpha-24 text-text-secondary hover:text-text-primary transition-colors cursor-pointer border-0"
                title="Скопировать ID ошибки для поддержки"
              >
                <CopyIcon />
                <span>{copiedId ? "Скопировано!" : `ID: ${toast.requestId.length > 14 ? toast.requestId.slice(0, 12) + "..." : toast.requestId}`}</span>
              </button>
            </div>
          )}
        </div>
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
          className="inline-flex items-center gap-[4px] px-[8px] py-[4px] rounded-lg text-[12px] font-[500] bg-btn-primary-bg text-btn-primary-text hover:opacity-90 active:scale-[0.96] transition-all border-0 cursor-pointer shadow-sm shrink-0"
        >
          {toast.action.icon}
          <span>{toast.action.label}</span>
        </button>
      )}
    </motion.div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
