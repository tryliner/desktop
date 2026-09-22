import { useEffect, useState } from "react";
import { LuMinus, LuSquare, LuX } from "react-icons/lu";
import { useIsContentTransparent } from "@/features/settings/store/customizationStore";

export interface WindowControlsProps {
  className?: string;
  variant?: "default" | "glass" | "island";
  style?: React.CSSProperties;
  isFullscreen?: boolean;
}

export default function WindowControls({
  className = "",
  variant = "default",
  style,
  isFullscreen = false,
}: WindowControlsProps) {
  const [isWindowFullScreen, setIsWindowFullScreen] = useState(false);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);

  useEffect(() => {
    if (!window.linerElectron) return;

    // hydrate initial os window state
    window.linerElectron.isFullScreen?.().then((fs) => {
      if (typeof fs === "boolean") setIsWindowFullScreen(fs);
    });
    window.linerElectron.isMaximized?.().then((max) => {
      if (typeof max === "boolean") setIsWindowMaximized(max);
    });

    // live sync across os fullscreen transitions & maximize toggles
    const unsubscribe = window.linerElectron.onWindowStateChange?.((state) => {
      setIsWindowFullScreen(state.isFullScreen);
      setIsWindowMaximized(state.isMaximized);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const isHyprland = window.linerElectron?.isHyprland ?? false;

  const handleMinimize = () => {
    // macos fullscreen spaces and hyprland tiling wm prohibit/ignore minimizing
    if (isWindowFullScreen || isHyprland) return;
    window.linerElectron?.minimize();
  };

  const handleMaximize = () => {
    window.linerElectron?.toggleMaximize();
  };

  const handleClose = () => {
    window.linerElectron?.close();
  };

  const isDarkMode = isFullscreen;
  const isMinimizeDisabled = isWindowFullScreen || isHyprland;
  const hasCustomBg = useIsContentTransparent();
  const isGlass = hasCustomBg || variant === "glass";

  return (
    <div
      style={style}
      className={`absolute top-[12px] right-[32px] z-[62] flex items-center justify-end pointer-events-none select-none ${className}`.trim()}
    >
      <div
        data-no-window-drag
        className={`flex items-center h-[32px] min-h-[32px] max-h-[32px] box-border px-[3px] gap-[2px] rounded-lg pointer-events-auto transition-colors ${
          isFullscreen
            ? "apple-glass-pill-dark text-white"
            : isGlass
              ? "apple-glass-pill text-text-primary"
              : isDarkMode
                ? "bg-black/50 text-white backdrop-blur-xl"
                : "bg-bg-panel/90 text-text-primary backdrop-blur-xl"
        }`}
      >
        <button
          type="button"
          onClick={isMinimizeDisabled ? undefined : handleMinimize}
          disabled={isMinimizeDisabled}
          aria-disabled={isMinimizeDisabled}
          className={`flex items-center justify-center w-[26px] h-[26px] min-w-[26px] min-h-[26px] max-h-[26px] rounded-md border-none bg-transparent transition-colors ${
            isMinimizeDisabled
              ? "opacity-30 cursor-not-allowed pointer-events-none"
              : isFullscreen
                ? "text-white/80 hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer"
                : isGlass
                  ? "text-text-primary hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 cursor-pointer"
                  : isDarkMode
                    ? "text-white/70 hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer"
                    : "text-text-primary hover:bg-border-alpha-14 active:scale-95 cursor-pointer"
          }`}
          aria-label="Minimize"
          title={isMinimizeDisabled ? undefined : "Minimize"}
        >
          <LuMinus size={13} />
        </button>
        <button
          type="button"
          onClick={handleMaximize}
          className={`flex items-center justify-center w-[26px] h-[26px] min-w-[26px] min-h-[26px] max-h-[26px] rounded-md cursor-pointer border-none bg-transparent transition-colors active:scale-95 ${
            isFullscreen
              ? "text-white/80 hover:text-white hover:bg-white/10"
              : isGlass
                ? "text-text-primary hover:bg-black/10 dark:hover:bg-white/10"
                : isDarkMode
                  ? "text-white/70 hover:text-white hover:bg-white/10"
                  : "text-text-primary hover:bg-border-alpha-14"
          }`}
          aria-label={
            isWindowFullScreen
              ? "Exit Fullscreen"
              : isWindowMaximized
                ? "Restore"
                : "Maximize"
          }
          title={
            isWindowFullScreen
              ? "Exit Fullscreen"
              : isWindowMaximized
                ? "Restore"
                : "Maximize"
          }
        >
          <LuSquare size={11} />
        </button>
        <button
          type="button"
          onClick={handleClose}
          className={`flex items-center justify-center w-[26px] h-[26px] min-w-[26px] min-h-[26px] max-h-[26px] rounded-md cursor-pointer border-none bg-transparent transition-colors hover:bg-[#E81123] hover:text-white active:scale-95 ${
            isFullscreen
              ? "text-white/80 hover:text-white hover:bg-[#E81123]"
              : isGlass
                ? "text-text-primary hover:bg-[#E81123]"
                : isDarkMode
                  ? "text-white/70 hover:text-white"
                  : "text-text-primary"
          }`}
          aria-label="Close"
          title="Close"
        >
          <LuX size={13} />
        </button>
      </div>
    </div>
  );
}






