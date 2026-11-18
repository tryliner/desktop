import {
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void | Promise<void>;
  danger?: boolean;
  disabled?: boolean;
  /** persistent highlight for the currently selected option */
  active?: boolean;
  /** nested items, shown in a flyout on hover, click or ArrowRight */
  children?: DropdownMenuItem[];
  /** draws a divider above this item */
  separator?: boolean;
}

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  position?: { x: number; y: number } | null;
  side?: "top" | "bottom";
  align?: "start" | "end";
}

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
    const height = Math.max(rect.height, menuRef.current.scrollHeight);
    let left = align === "end" ? position.x - rect.width : position.x;
    let top = side === "top" ? position.y - height : position.y;
    let maxHeight: number | undefined;

    if (left + rect.width > window.innerWidth) {
      left = window.innerWidth - rect.width - 8;
    }
    if (left < 8) left = 8;

    const spaceBelow = window.innerHeight - position.y - 8;
    const spaceAbove = position.y - 16;
    if (side !== "top" && height > spaceBelow) {
      if (spaceAbove > spaceBelow) {
        maxHeight = Math.min(height, spaceAbove);
        top = position.y - maxHeight - 8;
      } else {
        maxHeight = spaceBelow;
      }
    }
    if (side === "top" && height > spaceAbove + 8) {
      maxHeight = spaceAbove + 8;
      top = 8;
    }
    if (top < 8) top = 8;

    setStyle({ left, top, maxHeight });
  }, [isFixed, position, open, menuRef, side, align]);

  return style;
}

export default function DropdownMenu({
  trigger,
  items,
  open: controlledOpen,
  onOpenChange,
  position,
  side = "bottom",
  align = "start",
}: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [computedPos, setComputedPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!position && open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = align === "end" ? rect.right : rect.left;
      const y = side === "top" ? rect.top - 4 : rect.bottom + 4;
      setComputedPos({ x, y });
    }
  }, [open, position, side, align]);

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

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current?.contains(target) ||
        containerRef.current?.contains(target) ||
        (target instanceof Element &&
          target.closest('[data-dropdown-menu="true"]'))
      ) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen]);

  const menuContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="dropdown-menu"
          ref={menuRef}
          data-dropdown-menu="true"
          initial={{ opacity: 0, scale: 0.96, y: side === "top" ? 2 : -2 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: side === "top" ? 2 : -2 }}
          transition={{ duration: 0.1, ease: "easeOut" }}
          className={`overflow-y-auto overscroll-contain rounded-[11px] p-[4px] min-w-[160px] border-0 bg-fill backdrop-blur-2xl backdrop-saturate-150 ${
            isFixed
              ? "fixed z-[99999]"
              : side === "top"
                ? "absolute right-0 bottom-full mb-1 z-50"
                : "absolute right-0 top-full mt-1 z-50"
          }`}
          style={isFixed ? fixedStyle : {}}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItems items={items} onClose={() => setOpen(false)} />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onClick={(e) => {
        if (!position) {
          e.stopPropagation();
          setOpen(!open);
        }
      }}
    >
      {trigger}
      {isFixed && typeof document !== "undefined"
        ? createPortal(menuContent, document.body)
        : menuContent}
    </div>
  );
}

const ROW_CLASS =
  "group flex w-full h-[30px] items-center gap-[8px] rounded-control px-[9px] text-body font-normal transition-colors border-none bg-transparent text-left cursor-pointer select-none outline-none";

function MenuItems({
  items,
  onClose,
}: {
  items: DropdownMenuItem[];
  onClose: () => void;
}) {
  const [flyout, setFlyout] = useState<{
    id: string;
    rect: DOMRect;
  } | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const openFlyout = (id: string, el: HTMLElement) => {
    window.clearTimeout(closeTimer.current);
    setFlyout({ id, rect: el.getBoundingClientRect() });
  };
  const scheduleClose = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setFlyout(null), 180);
  };

  const flyoutItem = flyout
    ? items.find((item) => item.id === flyout.id)
    : undefined;

  return (
    <div className="flex flex-col gap-[1px]">
      {items.map((item) => {
        const hasChildren = Boolean(item.children?.length);
        return (
          <div key={item.id} className="contents">
            {item.separator && (
              <div
                role="separator"
                className="mx-[6px] my-[3px] h-px bg-border-alpha-14"
              />
            )}
            <button
              type="button"
              disabled={item.disabled}
              aria-haspopup={hasChildren ? "menu" : undefined}
              aria-expanded={hasChildren ? flyout?.id === item.id : undefined}
              onMouseEnter={(e) => {
                if (hasChildren) openFlyout(item.id, e.currentTarget);
                else if (flyout) scheduleClose();
              }}
              onMouseLeave={() => {
                if (hasChildren) scheduleClose();
              }}
              onKeyDown={(e) => {
                if (hasChildren && e.key === "ArrowRight") {
                  e.preventDefault();
                  openFlyout(item.id, e.currentTarget);
                }
              }}
              onClick={async (e) => {
                e.stopPropagation();
                if (hasChildren) {
                  openFlyout(item.id, e.currentTarget);
                  return;
                }
                onClose();
                await item.onClick();
              }}
              className={`${ROW_CLASS} ${
                item.danger
                  ? "text-red-400 hover:bg-red-500/10 hover:text-red-400"
                  : "text-text-primary hover:bg-fill"
              } ${
                item.active || flyout?.id === item.id ? "bg-fill" : ""
              } disabled:pointer-events-none disabled:opacity-40`}
              aria-current={item.active ? "true" : undefined}
            >
              {item.icon && (
                <span
                  className={`shrink-0 flex items-center justify-center text-title ${
                    item.danger
                      ? "text-red-400"
                      : "text-text-secondary group-hover:text-text-primary"
                  } transition-colors`}
                >
                  {item.icon}
                </span>
              )}
              <span className="truncate flex-1">{item.label}</span>
              {hasChildren && (
                <svg
                  aria-hidden
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  className="shrink-0 text-text-tertiary"
                >
                  <path
                    d="M4.5 2.5 8 6l-3.5 3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>
        );
      })}
      {flyout &&
        flyoutItem?.children &&
        typeof document !== "undefined" &&
        createPortal(
          <Flyout
            anchor={flyout.rect}
            items={flyoutItem.children}
            onClose={onClose}
            onBack={() => setFlyout(null)}
            onEnter={() => window.clearTimeout(closeTimer.current)}
            onLeave={scheduleClose}
          />,
          document.body,
        )}
    </div>
  );
}

function Flyout({
  anchor,
  items,
  onClose,
  onBack,
  onEnter,
  onLeave,
}: {
  anchor: DOMRect;
  items: DropdownMenuItem[];
  onClose: () => void;
  onBack: () => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    left: anchor.right + 4,
    top: anchor.top - 4,
    visibility: "hidden",
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = anchor.right + 4;
    if (left + rect.width > window.innerWidth - 8) {
      left = anchor.left - rect.width - 4;
    }
    let top = anchor.top - 4;
    const maxHeight = window.innerHeight - 16;
    if (top + rect.height > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - 8 - rect.height);
    }
    setStyle({ left: Math.max(8, left), top, maxHeight });
    el.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({
      preventScroll: true,
    });
  }, [anchor]);

  return (
    <div
      ref={ref}
      role="menu"
      data-dropdown-menu="true"
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
      style={style}
    >
      <MenuItems items={items} onClose={onClose} />
    </div>
  );
}
