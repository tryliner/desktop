import { memo } from "react";
import { createPortal } from "react-dom";

export interface FloatingDragCardProps {
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  children: React.ReactNode;
}

function FloatingDragCard({
  x,
  y,
  offsetX,
  offsetY,
  width,
  children,
}: FloatingDragCardProps) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed top-0 left-0 pointer-events-none z-[99999] select-none rounded-md bg-bg-primary shadow-[0_16px_40px_rgba(0,0,0,0.8)] overflow-hidden"
      style={{
        width: `${width}px`,
        transform: `translate3d(${x - offsetX}px, ${y - offsetY}px, 0)`,
        willChange: "transform",
      }}
    >
      <div className="w-full h-full bg-border-alpha-14">
        {children}
      </div>
    </div>,
    document.body,
  );
}

export default memo(FloatingDragCard);
