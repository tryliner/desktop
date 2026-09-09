import { LuMinus, LuSquare, LuX } from "react-icons/lu";

export interface WindowControlsProps {
  className?: string;
  variant?: "default" | "glass";
}

export default function WindowControls({
  className = "",
  variant = "default",
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

  const isGlass = variant === "glass";

  return (
    <div
      className={`absolute top-0 right-0 h-[32px] z-[62] flex justify-end pointer-events-none ${className}`.trim()}
    >
      <div
        className={`flex h-full pointer-events-auto transition-colors ${
          isGlass
            ? "rounded-bl-xl bg-bg-primary/85 dark:bg-black/70 backdrop-blur-2xl border-b border-l border-black/15 dark:border-white/20 shadow-sm overflow-hidden"
            : "drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
        }`}
      >
        <button
          onClick={handleMinimize}
          className="flex items-center justify-center w-[40px] h-full cursor-pointer border-none bg-transparent transition-all text-text-secondary hover:text-text-primary hover:bg-border-alpha-14"
          aria-label="Minimize"
        >
          <LuMinus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className="flex items-center justify-center w-[40px] h-full cursor-pointer border-none bg-transparent transition-all text-text-secondary hover:text-text-primary hover:bg-border-alpha-14"
          aria-label="Maximize"
        >
          <LuSquare size={12} />
        </button>
        <button
          onClick={handleClose}
          className="flex items-center justify-center w-[40px] h-full cursor-pointer border-none bg-transparent transition-all text-text-secondary hover:text-white hover:bg-[#E81123]"
          aria-label="Close"
        >
          <LuX size={14} />
        </button>
      </div>
    </div>
  );
}


