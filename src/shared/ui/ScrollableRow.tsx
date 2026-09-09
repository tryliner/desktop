import useHorizontalScroll from "@/shared/hooks/useHorizontalScroll";

interface ScrollableRowProps {
  children: React.ReactNode;
  className?: string;
  overlayWidth?: string;
  leftOverlayClassName?: string;
  rightOverlayClassName?: string;
  dragCursor?: string;
  wheelMultiplier?: number;
}

export function ScrollableRow({
  children,
  className = "",
  overlayWidth = "w-[100px]",
  leftOverlayClassName,
  rightOverlayClassName,
  dragCursor,
  wheelMultiplier,
}: ScrollableRowProps) {
  const { scrollRef, showLeftShadow, showRightShadow } = useHorizontalScroll({
    dragCursor,
    wheelMultiplier,
  });

  const baseOverlayClasses = `absolute top-0 bottom-0 ${overlayWidth} z-10 pointer-events-none transition-opacity duration-300`;
  const leftClasses = `${baseOverlayClasses} left-0 ${leftOverlayClassName ?? "bg-gradient-to-r from-bg-primary to-transparent"} ${showLeftShadow ? "opacity-100" : "opacity-0"}`;
  const rightClasses = `${baseOverlayClasses} right-0 ${rightOverlayClassName ?? "bg-gradient-to-l from-bg-primary to-transparent"} ${showRightShadow ? "opacity-100" : "opacity-0"}`;

  return (
    <div className="relative group">
      <div className={leftClasses} />

      <div
        ref={scrollRef}
        className={`no-scrollbar ${className}`}
        style={{
          overflowX: "auto",
          display: "flex",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {children}
      </div>

      <div className={rightClasses} />
    </div>
  );
}

export default ScrollableRow;
