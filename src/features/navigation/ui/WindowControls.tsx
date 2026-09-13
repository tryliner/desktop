import { LuMinus, LuSquare, LuX } from "react-icons/lu";

export interface WindowControlsProps {
  className?: string;
  variant?: "default" | "glass" | "island";
}

// unified dark matte glass floating island with 3 window control buttons
export default function WindowControls({
  className = "",
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
      className={`absolute top-[12px] right-[32px] h-[32px] z-[62] flex items-center justify-end pointer-events-none select-none ${className}`.trim()}
    >
      <div
        data-no-window-drag
        className="flex items-center h-[32px] px-[3px] gap-[2px] rounded-md bg-black/70 backdrop-blur-md text-text-primary pointer-events-auto transition-colors"
      >
        <button
          type="button"
          onClick={handleMinimize}
          className="flex items-center justify-center w-[28px] h-[26px] rounded-sm cursor-pointer border-none bg-transparent transition-colors text-text-primary hover:bg-white/10 active:scale-95"
          aria-label="Minimize"
          title="Minimize"
        >
          <LuMinus size={13} />
        </button>
        <button
          type="button"
          onClick={handleMaximize}
          className="flex items-center justify-center w-[28px] h-[26px] rounded-sm cursor-pointer border-none bg-transparent transition-colors text-text-primary hover:bg-white/10 active:scale-95"
          aria-label="Maximize"
          title="Maximize"
        >
          <LuSquare size={11} />
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="flex items-center justify-center w-[28px] h-[26px] rounded-sm cursor-pointer border-none bg-transparent transition-colors text-text-primary hover:bg-[#E81123] hover:text-white active:scale-95"
          aria-label="Close"
          title="Close"
        >
          <LuX size={13} />
        </button>
      </div>
    </div>
  );
}






