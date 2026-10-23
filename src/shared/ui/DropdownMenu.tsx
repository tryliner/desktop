import {
  useLayoutEffect,
  useEffect,
  useCallback,
  useRef,
  useState,
  Fragment,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckLine } from "@mingcute/react";

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void | Promise<void>;
  danger?: boolean;
  disabled?: boolean;
  checked?: boolean;
  closeOnSelect?: boolean;
  separatorBefore?: boolean;
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

  const focusTrigger = () => {
    containerRef.current
      ?.querySelector<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      )
      ?.focus();
  };

  const getEnabledMenuItems = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([disabled]), [role="menuitemcheckbox"]:not([disabled])',
      ) ?? [],
    );

  const setMenuElement = useCallback((node: HTMLDivElement | null) => {
    menuRef.current = node;
    if (!node) return;
    const menuItems = Array.from(
      node.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([disabled]), [role="menuitemcheckbox"]:not([disabled])',
      ),
    );
    const initiallyFocused = menuItems.find(
      (item) => item.getAttribute("aria-checked") === "true",
    ) ?? menuItems[0];
    initiallyFocused?.focus();
  }, []);

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
  const fixedStyle = useFixedStyle(menuRef, isFixed, targetPos, open, side, align);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        menuRef.current?.contains(e.target as Node) ||
        containerRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        focusTrigger();
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
          ref={setMenuElement}
          data-dropdown-menu="true"
          role="menu"
          initial={{ opacity: 0, scale: 0.96, y: side === "top" ? 2 : -2 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: side === "top" ? 2 : -2 }}
          transition={{ duration: 0.1, ease: "easeOut" }}
          className={`overflow-hidden rounded-md border border-border-primary/80 bg-bg-primary/95 backdrop-blur-md p-1 min-w-[160px] ${
            isFixed ? "fixed z-[99999]" : side === "top" ? "absolute right-0 bottom-full mb-1 z-50" : "absolute right-0 top-full mt-1 z-50"
          }`}
          style={isFixed ? fixedStyle : {}}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(event) => {
            const menuItems = getEnabledMenuItems();
            if (menuItems.length === 0) return;

            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              focusTrigger();
              setOpen(false);
              return;
            }

            const currentIndex = menuItems.indexOf(document.activeElement as HTMLElement);
            let nextIndex: number | undefined;
            if (event.key === "ArrowDown") {
              nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % menuItems.length;
            } else if (event.key === "ArrowUp") {
              nextIndex = currentIndex <= 0 ? menuItems.length - 1 : currentIndex - 1;
            } else if (event.key === "Home") {
              nextIndex = 0;
            } else if (event.key === "End") {
              nextIndex = menuItems.length - 1;
            }

            if (nextIndex !== undefined) {
              event.preventDefault();
              event.stopPropagation();
              menuItems[nextIndex]?.focus();
            }
          }}
        >
          <div className="flex flex-col gap-0.5">
            {items.map((item) => (
              <Fragment key={item.id}>
                {item.separatorBefore && (
                  <div role="separator" className="my-1 h-px bg-border-primary/70" />
                )}
                <button
                type="button"
                disabled={item.disabled}
                aria-label={item.label}
                role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                aria-checked={item.checked === undefined ? undefined : item.checked}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (item.closeOnSelect !== false) {
                    focusTrigger();
                    setOpen(false);
                  }
                  await item.onClick();
                }}
                className={`group flex w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-[13px] font-normal tracking-tight transition-colors border-none bg-transparent text-left cursor-pointer select-none outline-none ${
                  item.danger
                    ? "text-red-400 hover:bg-red-500/10 hover:text-red-400"
                    : "text-text-primary hover:bg-border-alpha-14"
                } disabled:pointer-events-none disabled:opacity-40`}
                style={{
                  fontFamily: "var(--font-inter), sans-serif",
                }}
              >
                {item.icon && (
                  <span
                    className={`shrink-0 flex items-center justify-center text-[15px] ${
                      item.danger
                        ? "text-red-400"
                        : "text-text-secondary group-hover:text-text-primary"
                    } transition-colors`}
                  >
                    {item.icon}
                  </span>
                )}
                <span className="truncate flex-1">{item.label}</span>
                {item.checked !== undefined && (
                  <span
                    data-dropdown-check="true"
                    aria-hidden="true"
                    className={`flex h-4 w-4 shrink-0 items-center justify-center transition-opacity ${item.checked ? "opacity-100" : "opacity-0"}`}
                  >
                    <CheckLine size={14} />
                  </span>
                )}
                </button>
              </Fragment>
            ))}
          </div>
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
