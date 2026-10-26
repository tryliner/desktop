import type { CSSProperties, KeyboardEventHandler, RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/shared/lib";
import type { DropdownMenuItem } from "./DropdownMenu";

interface DropdownMenuContentProps {
  open: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  menuTheme: string | undefined;
  side: "top" | "bottom";
  isFixed: boolean;
  fixedStyle: CSSProperties;
  onMenuKeyDown: KeyboardEventHandler<HTMLDivElement>;
  closeAndFocus: () => void;
  items: DropdownMenuItem[];
}

export function DropdownMenuContent({
  open,
  menuRef,
  menuTheme,
  side,
  isFixed,
  fixedStyle,
  onMenuKeyDown,
  closeAndFocus,
  items,
}: DropdownMenuContentProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="dropdown-menu"
          ref={menuRef}
          data-dropdown-menu="true"
          data-theme={menuTheme}
          role="menu"
          initial={{ opacity: 0, scale: 0.96, y: side === "top" ? 2 : -2 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: side === "top" ? 2 : -2 }}
          transition={{ duration: 0.1, ease: "easeOut" }}
          className={cn(
            "overflow-hidden rounded-[11px] p-[4px] min-w-[160px] border-0 bg-black/[0.05] dark:bg-white/[0.07] backdrop-blur-2xl backdrop-saturate-150",
            isFixed
              ? "fixed z-[99999]"
              : side === "top"
                ? "absolute right-0 bottom-full mb-1 z-50"
                : "absolute right-0 top-full mt-1 z-50",
          )}
          style={{
            ...(isFixed ? fixedStyle : {}),
            backgroundColor:
              menuTheme === "dark" ? "rgb(18 20 24 / 88%)" : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={onMenuKeyDown}
        >
          <div className="flex flex-col gap-[1px]">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role={
                  item.checked !== undefined
                    ? "menuitemcheckbox"
                    : item.active === undefined
                      ? "menuitem"
                      : "menuitemradio"
                }
                aria-checked={item.checked ?? item.active}
                disabled={item.disabled}
                onClick={async (e) => {
                  e.stopPropagation();
                  closeAndFocus();
                  await item.onClick();
                }}
                className={cn(
                  "group flex w-full h-[30px] items-center gap-[8px] rounded-[8px] px-[9px] text-[13px] font-normal transition-colors border-none bg-transparent text-left cursor-pointer select-none outline-none",
                  item.danger
                    ? "text-red-400 hover:bg-red-500/10 hover:text-red-400 focus-visible:bg-red-500/10"
                    : "text-text-primary hover:bg-black/[0.05] dark:hover:bg-white/[0.08] focus-visible:bg-black/[0.08] dark:focus-visible:bg-white/[0.14]",
                  item.active && "bg-black/[0.05] dark:bg-white/[0.08]",
                  "disabled:pointer-events-none disabled:opacity-40",
                )}
                aria-current={item.active ? "true" : undefined}
                style={{
                  fontFamily: "var(--font-inter), sans-serif",
                }}
              >
                {item.icon && (
                  <span
                    className={cn(
                      "shrink-0 flex items-center justify-center text-[15px]",
                      item.danger
                        ? "text-red-400"
                        : "text-text-secondary group-hover:text-text-primary",
                      "transition-colors",
                    )}
                  >
                    {item.icon}
                  </span>
                )}
                <span className="truncate flex-1">{item.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
