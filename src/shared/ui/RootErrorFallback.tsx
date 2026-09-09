import React, { useState, useMemo, useCallback } from "react";
import {
  LuTriangleAlert,
  LuRefreshCw,
  LuRotateCcw,
  LuHouse,
  LuCopy,
  LuCheck,
  LuChevronDown,
  LuChevronUp,
} from "react-icons/lu";
import WindowControls from "@/features/navigation/ui/WindowControls";
import Button from "./Button";
import { createTranslatorSync, getStoredLocale } from "@/languages";
import { useWindowDrag } from "@/shared/hooks";

export interface RootErrorFallbackProps {
  error: Error | null;
  errorInfo?: React.ErrorInfo | null;
  onReset?: () => void;
  onReload?: () => void;
  onGoHome?: () => void;
}

export function RootErrorFallback({
  error,
  errorInfo,
  onReset,
  onReload,
  onGoHome,
}: RootErrorFallbackProps) {
  useWindowDrag();
  const [showDetails, setShowDetails] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Safe translator lookup without relying on React context
  const t = useMemo(() => {
    try {
      const locale = getStoredLocale();
      return createTranslatorSync(locale);
    } catch {
      return (key: string) => key;
    }
  }, []);

  const handleReload = useCallback(() => {
    if (onReload) {
      onReload();
    } else if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, [onReload]);

  const handleGoHome = useCallback(() => {
    if (onGoHome) {
      onGoHome();
    } else if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  }, [onGoHome]);

  const errorDetailsString = useMemo(() => {
    const lines: string[] = [
      "=== Liner Desktop Client Error Report ===",
      `Time: ${new Date().toISOString()}`,
      `URL: ${typeof window !== "undefined" ? window.location.href : "unknown"}`,
      `User Agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "unknown"}`,
      `App Version: 0.1.8`,
      "",
      `Error Name: ${error?.name ?? "Error"}`,
      `Error Message: ${error?.message ?? "Unknown error"}`,
    ];

    if (error?.stack) {
      lines.push("", "--- JavaScript Stack Trace ---", error.stack);
    }

    if (errorInfo?.componentStack) {
      lines.push("", "--- Component Stack ---", errorInfo.componentStack);
    }

    return lines.join("\n");
  }, [error, errorInfo]);

  const handleCopy = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(errorDetailsString);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy error details to clipboard:", err);
    }
  }, [errorDetailsString]);

  const titleText =
    t("error_screen.title") !== "error_screen.title"
      ? t("error_screen.title")
      : "Something went wrong";

  const subtitleText =
    t("error_screen.subtitle") !== "error_screen.subtitle"
      ? t("error_screen.subtitle")
      : "An unexpected error occurred in Liner. You can reload the app or try again.";

  const reloadText =
    t("error_screen.reload") !== "error_screen.reload"
      ? t("error_screen.reload")
      : "Reload app";

  const tryAgainText =
    t("error_screen.try_again") !== "error_screen.try_again"
      ? t("error_screen.try_again")
      : "Try again";

  const goHomeText =
    t("error_screen.go_home") !== "error_screen.go_home"
      ? t("error_screen.go_home")
      : "Go to home";

  const copyDetailsText =
    t("error_screen.copy_details") !== "error_screen.copy_details"
      ? t("error_screen.copy_details")
      : "Copy error details";

  const copiedText =
    t("error_screen.copied") !== "error_screen.copied"
      ? t("error_screen.copied")
      : "Copied to clipboard";

  const showDetailsText =
    t("error_screen.show_details") !== "error_screen.show_details"
      ? t("error_screen.show_details")
      : "Show technical details";

  const hideDetailsText =
    t("error_screen.hide_details") !== "error_screen.hide_details"
      ? t("error_screen.hide_details")
      : "Hide technical details";

  const errorDetailsLabel =
    t("error_screen.error_details") !== "error_screen.error_details"
      ? t("error_screen.error_details")
      : "Error Details";

  return (
    <div
      role="alert"
      className="relative flex flex-col h-screen w-screen overflow-hidden rounded-5xl bg-bg-canvas p-1.5 select-none"
    >
      {/* Window Controls */}
      <WindowControls />

      {/* Main Container */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full bg-bg-primary rounded-sm border border-border-primary/40 p-6 md:p-10 overflow-y-auto">
        <div className="flex flex-col items-center max-w-[560px] w-full text-center my-auto">
          {/* Error Icon Badge */}
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-primary/10 text-accent-primary border border-accent-primary/20 mb-5 shadow-sm">
            <LuTriangleAlert size={28} />
          </div>

          {/* Title & Subtitle */}
          <h1
            className="text-[22px] md:text-[24px] font-[600] text-text-primary tracking-tight m-0 mb-2"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {titleText}
          </h1>
          <p
            className="text-[14px] text-text-secondary leading-relaxed m-0 mb-6 max-w-[460px]"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {subtitleText}
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 w-full mb-6">
            <Button
              variant="primary"
              size="default"
              onClick={handleReload}
              className="gap-2"
            >
              <LuRefreshCw size={15} />
              <span>{reloadText}</span>
            </Button>

            {onReset && (
              <Button
                variant="secondary"
                size="default"
                onClick={onReset}
                className="gap-2"
              >
                <LuRotateCcw size={15} />
                <span>{tryAgainText}</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="default"
              onClick={handleGoHome}
              className="gap-2"
            >
              <LuHouse size={15} />
              <span>{goHomeText}</span>
            </Button>
          </div>

          {/* Details Toggle Button */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-[13px] text-text-tertiary hover:text-text-primary transition-colors border-none bg-transparent cursor-pointer py-1 px-2 rounded-xs"
            >
              <span>{showDetails ? hideDetailsText : showDetailsText}</span>
              {showDetails ? (
                <LuChevronUp size={14} />
              ) : (
                <LuChevronDown size={14} />
              )}
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 text-[13px] text-text-tertiary hover:text-text-primary transition-colors border-none bg-transparent cursor-pointer py-1 px-2 rounded-xs"
            >
              {isCopied ? (
                <>
                  <LuCheck size={14} className="text-green-500" />
                  <span className="text-green-500">{copiedText}</span>
                </>
              ) : (
                <>
                  <LuCopy size={14} />
                  <span>{copyDetailsText}</span>
                </>
              )}
            </button>
          </div>

          {/* Collapsible Error Details Box */}
          {showDetails && (
            <div className="mt-4 w-full text-left rounded-md border border-border-primary bg-bg-canvas/50 p-4 max-h-[260px] overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                  {errorDetailsLabel}
                </span>
                <span className="text-[11px] text-accent-primary font-mono font-medium">
                  {error?.name || "Error"}
                </span>
              </div>
              <pre className="text-[12px] font-mono text-text-secondary whitespace-pre-wrap break-all leading-relaxed m-0 select-text">
                {errorDetailsString}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RootErrorFallback;
