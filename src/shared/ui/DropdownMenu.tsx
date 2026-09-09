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
}

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  position?: { x: number; y: number } | null;
}

function useFixedStyle(
  menuRef: RefObject<HTMLDivElement | null>,
  isFixed: boolean,
  position: { x: number; y: number } | null | undefined,
  open: boolean,
): React.CSSProperties {
  const [style, setStyle] = useState<React.CSSProperties>(() =>
    position ? { left: position.x, top: position.y } : {},
  );

  useLayoutEffect(() => {
    if (!isFixed || !position || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    let left = position.x;
    let top = position.y;

    if (left + rect.width > window.innerWidth) {
      left = position.x - rect.width;
    }
    if (top + rect.height > window.innerHeight) {
      top = position.y - rect.height;
    }
    if (left < 0) left = 0;
    if (top < 0) top = 0;

    setStyle({ left, top });
  }, [isFixed, position, open, menuRef]);

  return style;
}

export default function DropdownMenu({
  trigger,
  items,
  open: controlledOpen,
  onOpenChange,
  position,
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
      setComputedPos({ x: rect.left, y: rect.bottom + 4 });
    }
  }, [open, position]);

  const targetPos = position || computedPos;
  const isFixed = Boolean(targetPos);
  const fixedStyle = useFixedStyle(menuRef, isFixed, targetPos, open);

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
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          className={`overflow-hidden rounded-md border border-border-primary bg-bg-primary p-[4px] shadow-2xl ${
            isFixed ? "fixed z-[99999]" : "absolute right-0 top-full mt-[4px] z-50"
          }`}
          style={isFixed ? fixedStyle : {}}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-[2px] min-w-[140px]">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={async (e) => {
                  e.stopPropagation();
                  setOpen(false);
                  await item.onClick();
                }}
                className={`flex w-full items-center gap-[8px] rounded-md px-[10px] py-[6px] text-[13px] transition-colors border-none bg-transparent text-left cursor-pointer ${
                  item.danger
                    ? "text-red-500 hover:bg-red-500/10"
                    : "text-text-primary hover:bg-border-alpha-14"
                } disabled:pointer-events-none disabled:opacity-40`}
                style={{
                  fontFamily: "var(--font-inter), sans-serif",
                  fontWeight: 400,
                }}
              >
                {item.icon && (
                  <span
                    className={`shrink-0 flex items-center ${
                      item.danger ? "text-red-500" : "text-text-secondary"
                    }`}
                  >
                    {item.icon}
                  </span>
                )}
                <span className="truncate">{item.label}</span>
              </button>
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
