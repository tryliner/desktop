import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface FlyoutPlacement {
  left: number;
  top: number;
  maxHeight?: number;
  hidden: boolean;
}

interface DropdownFlyoutProps {
  anchor: DOMRect;
  ownerId: string;
  onBack: () => void;
  onEnter: () => void;
  onLeave: () => void;
  children: ReactNode;
}

function place(anchor: DOMRect, rect: DOMRect): FlyoutPlacement {
  let left = anchor.right + 4;
  if (left + rect.width > window.innerWidth - 8) {
    left = anchor.left - rect.width - 4;
  }
  let top = anchor.top - 4;
  if (top + rect.height > window.innerHeight - 8) {
    top = Math.max(8, window.innerHeight - 8 - rect.height);
  }
  return {
    left: Math.max(8, left),
    top,
    maxHeight: window.innerHeight - 16,
    hidden: false,
  };
}

export function DropdownFlyout({
  anchor,
  ownerId,
  onBack,
  onEnter,
  onLeave,
  children,
}: DropdownFlyoutProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<FlyoutPlacement>({
    left: anchor.right + 4,
    top: anchor.top - 4,
    hidden: true,
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPlacement(place(anchor, el.getBoundingClientRect()));
    el.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({
      preventScroll: true,
    });
  }, [anchor]);

  return (
    <div
      ref={ref}
      role="menu"
      data-dropdown-menu="true"
      data-dropdown-owner={ownerId}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onBack();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-[100000] min-w-[180px] max-w-[280px] overflow-y-auto overscroll-contain rounded-[11px] border-0 bg-fill p-[4px] backdrop-blur-2xl backdrop-saturate-150"
      style={{
        left: placement.left,
        top: placement.top,
        maxHeight: placement.maxHeight,
        visibility: placement.hidden ? "hidden" : undefined,
      }}
    >
      {children}
    </div>
  );
}
