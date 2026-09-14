import { LuMinus, LuSquare, LuX } from "react-icons/lu";

export interface WindowControlsProps {
  className?: string;
  variant?: "default" | "glass" | "island";
  style?: React.CSSProperties;
  isFullscreen?: boolean;
}

export default function WindowControls({
  className = "",
  style,
  isFullscreen = false,
}: WindowControlsProps) {
  const handleMinimize = () => {
    window.linerElectron?.minimize();
  };

  const handleMaximize = () => {
    window.linerElectron?.toggleMaximize();
  };

  const handleClose = () => {
    window.linerElectron?.close();
  };

  return (
    <div
      style={style}
      className={`absolute top-[12px] right-[32px] z-[62] flex items-center justify-end pointer-events-none select-none ${className}`.trim()}
    >
      <div
        data-no-window-drag
        className={`flex items-center h-[32px] min-h-[32px] max-h-[32px] box-border px-[3px] gap-[2px] rounded-lg backdrop-blur-xl pointer-events-auto transition-colors ${
          isFullscreen
            ? "bg-black/50 text-white"
            : "bg-bg-panel/90 border border-border-primary/60 text-text-primary"
        }`}
      >
        <button
          type="button"
          onClick={handleMinimize}
          className={`flex items-center justify-center w-[26px] h-[26px] min-w-[26px] min-h-[26px] max-h-[26px] rounded-md cursor-pointer border-none bg-transparent transition-colors active:scale-95 ${
            isFullscreen
              ? "text-white/70 hover:text-white hover:bg-white/10"
              : "text-text-primary hover:bg-border-alpha-14"
          }`}
          aria-label="Minimize"
          title="Minimize"
        >
          <LuMinus size={13} />
        </button>
        <button
          type="button"
          onClick={handleMaximize}
          className={`flex items-center justify-center w-[26px] h-[26px] min-w-[26px] min-h-[26px] max-h-[26px] rounded-md cursor-pointer border-none bg-transparent transition-colors active:scale-95 ${
            isFullscreen
              ? "text-white/70 hover:text-white hover:bg-white/10"
              : "text-text-primary hover:bg-border-alpha-14"
          }`}
          aria-label="Maximize"
          title="Maximize"
        >
          <LuSquare size={11} />
        </button>
        <button
          type="button"
          onClick={handleClose}
          className={`flex items-center justify-center w-[26px] h-[26px] min-w-[26px] min-h-[26px] max-h-[26px] rounded-md cursor-pointer border-none bg-transparent transition-colors hover:bg-[#E81123] hover:text-white active:scale-95 ${
            isFullscreen ? "text-white/70 hover:text-white" : "text-text-primary"
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






