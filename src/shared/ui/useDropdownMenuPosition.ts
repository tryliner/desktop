import { useLayoutEffect, useState, type RefObject } from "react";

function useFixedStyle(
  menuRef: RefObject<HTMLDivElement | null>,
  isFixed: boolean,
  position: { x: number; y: number } | null | undefined,
  open: boolean,
  side: "top" | "bottom" = "bottom",
  align: "start" | "end" = "start",
): React.CSSProperties {
  const [style, setStyle] = useState<React.CSSProperties>(() =>
    position ? { left: position.x, top: position.y } : {},
  );

  useLayoutEffect(() => {
    if (!isFixed || !position || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    let left = align === "end" ? position.x - rect.width : position.x;
    let top = side === "top" ? position.y - rect.height : position.y;

    if (left + rect.width > window.innerWidth) {
      left = window.innerWidth - rect.width - 8;
    }
    if (left < 8) left = 8;

    if (side !== "top" && top + rect.height > window.innerHeight) {
      top = position.y - rect.height - 8;
    }
    if (top < 8) top = 8;

    setStyle({ left, top });
  }, [isFixed, position, open, menuRef, side, align]);

  return style;
}

export function useDropdownMenuPosition(
  containerRef: RefObject<HTMLDivElement | null>,
  menuRef: RefObject<HTMLDivElement | null>,
  position: { x: number; y: number } | null | undefined,
  open: boolean,
  side: "top" | "bottom",
  align: "start" | "end",
) {
  const [menuTheme, setMenuTheme] = useState<string>();

  const [computedPos, setComputedPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (open && containerRef.current) {
      setMenuTheme(
        containerRef.current
          .closest("[data-theme]")
          ?.getAttribute("data-theme") ?? undefined,
      );
    }
    if (!position && open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = align === "end" ? rect.right : rect.left;
      const y = side === "top" ? rect.top - 4 : rect.bottom + 4;
      setComputedPos({ x, y });
    }
  }, [open, position, side, align, containerRef]);

  const targetPos = position || computedPos;
  const isFixed = Boolean(targetPos);
  const fixedStyle = useFixedStyle(
    menuRef,
    isFixed,
    targetPos,
    open,
    side,
    align,
  );
  return { menuTheme, isFixed, fixedStyle };
}
