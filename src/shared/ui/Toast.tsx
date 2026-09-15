import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "@/languages";
import { api } from "@/shared/api";
import { useImportStore } from "@/features/library/store/importStore";
import { useModalStore } from "@/features/library/store/modalStore";
import { notifyLibraryChanged } from "@/features/library/hooks/usePlaylists";
import ScrollableText from "./ScrollableText";

export type ToastVariant =
  | "success"
  | "error"
  | "info"
  | "loading"
  | "checkmark"
  | "loader";

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
  button?: ToastAction;
  icon?: React.ReactNode | "checkmark" | "loader" | "info" | "error";
  onDismiss?: () => void;
  inSettings?: boolean;
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
  button?: ToastAction;
  icon?: React.ReactNode | "checkmark" | "loader" | "info" | "error";
  onDismiss?: () => void;
  inSettings?: boolean;
}

export interface ToastCallable {
  (
    message: string,
    variantOrOptions?: ToastVariant | ToastOptions,
    options?: ToastOptions,
  ): void;
  success: (message: string, options?: ToastOptions) => void;
  checkmark: (message: string, options?: ToastOptions) => void;
  loader: (message: string, options?: ToastOptions) => void;
  loading: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
}

interface ToastContextValue {
  toast: ToastCallable;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function normalizeToastArgs(
  variantOrOptions?: ToastVariant | ToastOptions,
  maybeOptions?: ToastOptions,
): { variant: ToastVariant; options?: ToastOptions } {
  if (typeof variantOrOptions === "string") {
    return { variant: variantOrOptions, options: maybeOptions };
  }
  if (variantOrOptions && typeof variantOrOptions === "object") {
    const opts = variantOrOptions;
    let variant: ToastVariant = "info";
    if (
      opts.icon === "checkmark" ||
      opts.icon === "loader" ||
      opts.icon === "info" ||
      opts.icon === "error"
    ) {
      variant = opts.icon as ToastVariant;
    }
    return { variant, options: opts };
  }
  return { variant: "info", options: maybeOptions };
}

export function showToast(
  message: string,
  variantOrOptions?: ToastVariant | ToastOptions,
  maybeOptions?: ToastOptions,
) {
  if (typeof window === "undefined") return;
  const { variant, options } = normalizeToastArgs(variantOrOptions, maybeOptions);
  window.dispatchEvent(
    new CustomEvent("liner:toast", {
      detail: { message, variant, options },
    }),
  );
}

showToast.success = (message: string, options?: ToastOptions) =>
  showToast(message, "success", options);
showToast.checkmark = (message: string, options?: ToastOptions) =>
  showToast(message, "checkmark", options);
showToast.loader = (message: string, options?: ToastOptions) =>
  showToast(message, "loader", options);
showToast.loading = (message: string, options?: ToastOptions) =>
  showToast(message, "loading", options);
showToast.error = (message: string, options?: ToastOptions) =>
  showToast(message, "error", options);
showToast.info = (message: string, options?: ToastOptions) =>
  showToast(message, "info", options);

const DURATION = 3000;

const BATCH_FREEZE_COUNT = 3;
const MAX_BATCH_SIZE = 6;
const SWIPE_DISMISS_OFFSET_Y = -12;
const SWIPE_DISMISS_VELOCITY_Y = -120;

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

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 11v5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7.8" r="1.3" fill="currentColor" />
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

function ImportToastBridge({
  onToast,
  onDismiss,
}: {
  onToast: (
    message: string,
    variantOrOptions?: ToastVariant | ToastOptions,
    options?: ToastOptions,
  ) => void;
  onDismiss: (id: string | number) => void;
}) {
  const { t } = useSafeTranslation();
  const navigate = useNavigate();
  const job = useImportStore((state) => state.job);
  const reset = useImportStore((state) => state.reset);
  const openImportReview = useModalStore((state) => state.openImportReview);
  const isReviewOpen = useModalStore((state) => state.importReviewOpen);

  const [dismissedQueuedId, setDismissedQueuedId] = useState<string | null>(null);
  const [dismissedProgressId, setDismissedProgressId] = useState<string | null>(null);
  const [openingReview, setOpeningReview] = useState(false);

  const handleOpenReview = useCallback(async () => {
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
  }, [job, openingReview, openImportReview]);

  const finalizeWithMatches = useCallback(async (jobId: string) => {
    try {
      const res = await api.skipPlaylistImportReview(jobId);
      if (res.finalized) {
        const finalJob = await api.getPlaylistImport(jobId).catch(() => null);
        useImportStore.setState({ job: finalJob ?? null, isPolling: false });
        notifyLibraryChanged();
      }
    } catch {}
  }, []);

  const shouldShow =
    Boolean(job) &&
    !(job?.status === "queued" && dismissedQueuedId === job.id) &&
    !(job?.status === "running" && dismissedProgressId === job.id) &&
    !(job?.status === "awaiting_decision" && isReviewOpen);

  const isQueued = job?.status === "queued";
  const isRunning = job?.status === "running";
  const isAwaiting = job?.status === "awaiting_decision";
  const isFinalizing = job?.status === "finalizing";
  const isCompleted = job?.status === "completed";
  const isFailed = job?.status === "failed";

  const getSubtitle = useCallback(() => {
    if (!job) return "";
    if (isFailed) return t("import.status_failed");
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
  }, [job, isFailed, isQueued, isRunning, isAwaiting, isFinalizing, isCompleted, t]);

  const getTitle = useCallback(() => {
    if (isQueued) return t("import.status_queued");
    if (isRunning) return t("import.status_running");
    if (isAwaiting) return t("import.status_awaiting_decision");
    if (isFinalizing) return t("import.status_finalizing");
    if (isCompleted) return t("import.status_completed");
    return t("import.status_failed");
  }, [isQueued, isRunning, isAwaiting, isFinalizing, isCompleted, t]);

  useEffect(() => {
    if (!shouldShow || !job) {
      onDismiss("import-job-card");
      return;
    }

    const title = getTitle();
    const subtitle = getSubtitle();

    if (isQueued) {
      onToast(title, "checkmark", {
        id: "import-job-card",
        description: subtitle,
        duration: 3500,
        onDismiss: () => setDismissedQueuedId(job.id),
      });
      return;
    }

    if (isRunning || isFinalizing) {
      onToast(title, "loader", {
        id: "import-job-card",
        description: subtitle,
        duration: 999999,
        onDismiss: () => setDismissedProgressId(job.id),
      });
      return;
    }

    if (isAwaiting) {
      onToast(title, "info", {
        id: "import-job-card",
        description: subtitle,
        duration: 999999,
        action: {
          label: t("import.review_action"),
          onClick: () => void handleOpenReview(),
        },
        onDismiss: () => {
          setDismissedProgressId(job.id);
        },
      });
      return;
    }

    if (isCompleted) {
      onToast(title, "checkmark", {
        id: "import-job-card",
        description: subtitle,
        duration: 5000,
        action: job.playlistId
          ? {
              label: t("import.view_playlist"),
              onClick: () => {
                navigate(`/library/playlist?id=${encodeURIComponent(job.playlistId!)}`);
                reset();
              },
            }
          : undefined,
        onDismiss: reset,
      });
      return;
    }

    if (isFailed) {
      onToast(title, "error", {
        id: "import-job-card",
        description: subtitle,
        duration: 7000,
        onDismiss: reset,
      });
    }
  }, [
    shouldShow,
    job,
    job?.status,
    job?.result?.imported,
    job?.result?.total,
    isQueued,
    isRunning,
    isAwaiting,
    isFinalizing,
    isCompleted,
    isFailed,
    getTitle,
    getSubtitle,
    handleOpenReview,
    navigate,
    onDismiss,
    onToast,
    reset,
    t,
  ]);

  return null;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: string | number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toastCore = useCallback(
    (
      message: string,
      variantOrOptions?: ToastVariant | ToastOptions,
      maybeOptions?: ToastOptions,
    ) => {
      const { variant, options } = normalizeToastArgs(
        variantOrOptions,
        maybeOptions,
      );
      const id = options?.id ?? ++idRef.current;
      const isLoader =
        variant === "loading" ||
        variant === "loader" ||
        options?.icon === "loader";
      const duration = options?.duration ?? (isLoader ? 999999 : DURATION);
      const inSettings =
        options?.inSettings ?? Boolean(useModalStore.getState().settingsOpen);

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
          action: options?.action ?? options?.button,
          button: options?.button ?? options?.action,
          icon: options?.icon,
          onDismiss: options?.onDismiss,
          inSettings,
        };
        if (idx >= 0) {
          const next = [...current];
          next[idx] = {
            ...item,
            inSettings: current[idx].inSettings ?? item.inSettings,
          };
          return next;
        }
        return [item, ...current].slice(0, MAX_BATCH_SIZE);
      });
    },
    [],
  );

  const toastCallable = useMemo(() => {
    const fn = (
      message: string,
      variantOrOptions?: ToastVariant | ToastOptions,
      options?: ToastOptions,
    ) => toastCore(message, variantOrOptions, options);
    fn.success = (msg: string, opts?: ToastOptions) => toastCore(msg, "success", opts);
    fn.checkmark = (msg: string, opts?: ToastOptions) => toastCore(msg, "checkmark", opts);
    fn.loader = (msg: string, opts?: ToastOptions) => toastCore(msg, "loader", opts);
    fn.loading = (msg: string, opts?: ToastOptions) => toastCore(msg, "loading", opts);
    fn.error = (msg: string, opts?: ToastOptions) => toastCore(msg, "error", opts);
    fn.info = (msg: string, opts?: ToastOptions) => toastCore(msg, "info", opts);
    return fn as ToastCallable;
  }, [toastCore]);

  useEffect(() => {
    const handleCustomToast = (e: Event) => {
      const detail = (e as CustomEvent<{
        message: string;
        variant?: ToastVariant;
        options?: ToastOptions;
      }>).detail;
      if (detail && detail.message) {
        toastCore(detail.message, detail.variant, detail.options);
      }
    };
    window.addEventListener("liner:toast", handleCustomToast);
    return () => window.removeEventListener("liner:toast", handleCustomToast);
  }, [toastCore]);

  // Keep up to 3 cards in the visible stack (active + 2 in the batch deck)
  const visibleToasts = toasts.slice(0, 3);
  const [activeCardWidth, setActiveCardWidth] = useState<number | null>(null);
  const [activeCardHeight, setActiveCardHeight] = useState<number | null>(null);

  const handleMeasureActive = useCallback((w: number, h: number) => {
    if (w > 0) setActiveCardWidth((prev) => (prev === w ? prev : w));
    if (h > 0) setActiveCardHeight((prev) => (prev === h ? prev : h));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: toastCallable }}>
      {children}
      {/* top-center notification batch deck - positioned below window drag area */}
      <div className="fixed top-[44px] left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 480, damping: 38 }}
          className="relative grid grid-cols-1 grid-rows-1 items-start justify-items-center"
        >
          <AnimatePresence mode="popLayout">
            {visibleToasts.map((item, index) => (
              <NotificationCard
                key={item.id}
                item={item}
                index={index}
                batchSize={toasts.length}
                isTop={index === 0}
                activeCardWidth={activeCardWidth}
                activeCardHeight={activeCardHeight}
                onMeasureActive={handleMeasureActive}
                onDismiss={() => remove(item.id)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
      <ImportToastBridge onToast={toastCore} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

function NotificationCard({
  item,
  index,
  batchSize,
  isTop,
  activeCardWidth,
  activeCardHeight,
  onMeasureActive,
  onDismiss,
}: {
  item: Toast;
  index: number;
  batchSize: number;
  isTop: boolean;
  activeCardWidth: number | null;
  activeCardHeight: number | null;
  onMeasureActive: (w: number, h: number) => void;
  onDismiss: () => void;
}) {
  const { t } = useSafeTranslation();
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // measure active card dimensions so background deck cards can match its width exactly
  useLayoutEffect(() => {
    if (!isTop || !cardRef.current) return;
    const el = cardRef.current;
    if (el.offsetWidth > 0 || el.offsetHeight > 0) {
      onMeasureActive(el.offsetWidth, el.offsetHeight);
    }
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (cardRef.current && (cardRef.current.offsetWidth > 0 || cardRef.current.offsetHeight > 0)) {
        onMeasureActive(cardRef.current.offsetWidth, cardRef.current.offsetHeight);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isTop, onMeasureActive]);

  // mirror the dismiss callback so timer bookkeeping survives re-renders
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  // deck cards stay frozen until promoted to top slot
  const paused =
    index !== 0 || hovered || dragging || batchSize >= BATCH_FREEZE_COUNT;
  const remainingRef = useRef(item.duration);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (paused) return;
    if (!(item.duration < 999999)) return;
    if (remainingRef.current <= 0) {
      dismissRef.current();
      return;
    }
    startedAtRef.current = Date.now();
    const timer = setTimeout(() => dismissRef.current(), remainingRef.current);
    return () => {
      clearTimeout(timer);
      if (startedAtRef.current) {
        remainingRef.current = Math.max(
          0,
          remainingRef.current - (Date.now() - startedAtRef.current),
        );
        startedAtRef.current = 0;
      }
    };
  }, [paused, item.duration]);

  const dismiss = useCallback(() => {
    item.onDismiss?.();
    dismissRef.current();
  }, [item]);

  const handleCopyRequestId = (reqId: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(reqId).catch(() => {});
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2200);
    }
  };

  const shiftY = item.inSettings ? -19 : 0;
  const yOffset = (index === 0 ? 0 : index === 1 ? 8 : 15) + shiftY;
  const scale = index === 0 ? 1 : index === 1 ? 0.96 : 0.92;
  const opacity = index === 0 ? 1 : index === 1 ? 0.95 : 0.75;
  const zIndex = 30 - index * 10;
  const resolvedAction = item.action ?? item.button;

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={
        index === 0
          ? { opacity: 0, y: -20 + shiftY, scale: 0.95 }
          : { opacity: 0, y: yOffset, scale }
      }
      animate={{
        opacity,
        y: yOffset,
        scale,
        transition: {
          type: "spring",
          stiffness: 480,
          damping: 38,
          mass: 0.8,
        },
      }}
      exit={{
        opacity: 0,
        y: -48 + shiftY,
        scale: 0.92,
        transition: { duration: 0.18, ease: "easeIn" },
      }}
      drag={index === 0 ? "y" : false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.85, bottom: 0.08 }}
      onDragStart={() => setDragging(true)}
      onDragEnd={(_, info) => {
        setDragging(false);
        if (
          info.offset.y < SWIPE_DISMISS_OFFSET_Y ||
          info.velocity.y < SWIPE_DISMISS_VELOCITY_Y
        ) {
          dismiss();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-no-window-drag
      className={`relative flex items-center gap-[8px] rounded-[12px] bg-bg-elevated pl-[12px] ${
        resolvedAction ? "pr-[5px]" : "pr-[12px]"
      } py-[5px] min-h-[38px] box-border ${
        index === 0
          ? "pointer-events-auto cursor-grab active:cursor-grabbing"
          : "pointer-events-none select-none"
      }`}
      style={{
        gridArea: "1 / 1",
        zIndex,
        transformOrigin: "bottom center",
        fontFamily: "var(--font-inter), sans-serif",
        maxWidth: "min(520px, calc(100vw - 32px))",
        minHeight: "38px",
        width: index > 0 && activeCardWidth ? `${activeCardWidth}px` : undefined,
        height: index > 0 && activeCardHeight ? `${activeCardHeight}px` : undefined,
      }}
    >
      <span
        className="flex shrink-0 items-center justify-center text-text-tertiary"
        style={{ color: getNotificationIconColor(item.variant, item.icon) }}
      >
        {renderNotificationIcon(item.variant, item.icon)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
        <div className="flex min-w-0 items-center gap-[6px]">
          <ScrollableText
            text={item.message}
            className="max-w-[220px] shrink-0 text-text-primary text-[13px] font-[600] leading-tight"
            isParentHovered={hovered && index === 0}
          />
          {item.description && (
            <>
              <span aria-hidden className="shrink-0 text-text-tertiary text-[12.5px] leading-tight translate-y-[1px]">
                ·
              </span>
              <ScrollableText
                text={item.description}
                className="min-w-0 max-w-[260px] text-text-tertiary text-[12.5px] leading-tight translate-y-[1px]"
                isParentHovered={hovered && index === 0}
              />
            </>
          )}
        </div>
        {item.requestId && (
          <div className="mt-[4px] flex items-center gap-[6px]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCopyRequestId(item.requestId!);
              }}
              className="inline-flex items-center gap-[4px] px-[6px] py-[2px] rounded text-[11px] font-mono bg-border-alpha-14 hover:bg-border-alpha-33 text-text-secondary hover:text-text-primary transition-colors cursor-pointer border-0"
              title={t("settings.notifications.copy_request_id")}
            >
              <CopyIcon />
              <span>{copiedId ? t("settings.notifications.copied") : `ID: ${item.requestId.length > 14 ? item.requestId.slice(0, 12) + "..." : item.requestId}`}</span>
            </button>
          </div>
        )}
      </div>
      {resolvedAction && (
        <button
          type="button"
          onClick={() => {
            resolvedAction.onClick?.();
            dismiss();
          }}
          className="inline-flex shrink-0 items-center justify-center gap-[4px] px-[10px] h-[28px] rounded-lg text-[12.5px] font-[600] bg-border-alpha-14 hover:bg-border-alpha-33 text-text-primary active:scale-[0.96] transition-all border-0 cursor-pointer"
        >
          {resolvedAction.icon && <span>{resolvedAction.icon}</span>}
          <span>{resolvedAction.label}</span>
        </button>
      )}
    </motion.div>
  );
}

function renderNotificationIcon(
  variant: ToastVariant,
  customIcon?: React.ReactNode | "checkmark" | "loader" | "info" | "error",
) {
  if (customIcon && typeof customIcon !== "string") {
    return customIcon;
  }
  const resolved = (
    typeof customIcon === "string" ? customIcon : variant
  ).toLowerCase();

  switch (resolved) {
    case "success":
    case "checkmark":
    case "check":
      return <CheckIcon />;
    case "loading":
    case "loader":
    case "spinner":
      return <SpinnerIcon />;
    case "error":
      return <ErrorIcon />;
    case "info":
    default:
      return <InfoIcon />;
  }
}

function getNotificationIconColor(
  variant: ToastVariant,
  customIcon?: React.ReactNode | "checkmark" | "loader" | "info" | "error",
): string | undefined {
  if (customIcon && typeof customIcon !== "string") {
    return undefined;
  }
  const resolved = (
    typeof customIcon === "string" ? customIcon : variant
  ).toLowerCase();

  switch (resolved) {
    case "success":
    case "checkmark":
    case "check":
      return "#34A853";
    case "error":
      return "#EA4335";
    case "loading":
    case "loader":
    case "spinner":
      return "#4285F4";
    case "info":
    default:
      return undefined;
  }
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: showToast as ToastCallable,
    };
  }
  return ctx;
}
