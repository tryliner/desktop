import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** Optional icon/emoji rendered before the label */
  icon?: React.ReactNode;
}

export interface SelectProps<T extends string = string> {
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Where to anchor the dropdown. Default: "bottom-left" */
  align?: "bottom-left" | "bottom-right";
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  variant?: "default" | "transparent";
}

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    aria-hidden="true"
    className={`shrink-0 text-text-tertiary transition-transform duration-150 ${open ? "rotate-180" : ""}`}
  >
    <path
      d="M2.5 4.5L6 8L9.5 4.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    aria-hidden="true"
    className="shrink-0 text-text-primary"
  >
    <path
      d="M2 6.5L4.5 9L10 3"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function ScrollingLabel({ text }: { text: string }) {
  const outerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [delta, setDelta] = useState(0);
  const [hovered, setHovered] = useState(false);

  useLayoutEffect(() => {
    if (!outerRef.current || !innerRef.current) return;
    const d = innerRef.current.scrollWidth - outerRef.current.clientWidth;
    setDelta(Math.max(0, d));
  });

  return (
    <span
      ref={outerRef}
      className="relative flex-1 overflow-hidden text-left"
      style={
        delta > 0
          ? {
              maskImage:
                "linear-gradient(to right, black 70%, transparent 100%)",
            }
          : undefined
      }
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        ref={innerRef}
        className="inline-block whitespace-nowrap"
        style={{
          transform:
            hovered && delta > 0 ? `translateX(-${delta + 8}px)` : "translateX(0)",
          transition: hovered
            ? `transform ${Math.max(800, delta * 12)}ms linear`
            : "transform 300ms ease",
        }}
      >
        {text}
      </span>
    </span>
  );
}

export function Select<T extends string = string>({
  options,
  value,
  onChange,
  align = "bottom-left",
  placeholder = "Select\u2026",
  disabled = false,
  className = "",
  "aria-label": ariaLabel,
  variant = "default",
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const selected = options.find((o) => o.value === value);

  const isTransparent = variant === "transparent";
  // airy but never see-through: blurred elevated fill kills bg bleed
  const bgClass = className.includes("bg-")
    ? ""
    : isTransparent
      ? "bg-bg-elevated/60 backdrop-blur-md"
      : "bg-bg-primary";

  const borderClass = "border-border-primary";

  const hoverClass = isTransparent
    ? "hover:bg-bg-elevated"
    : "hover:bg-border-alpha-14";

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const menu = menuRef.current;

    menu.style.top = `${trigger.bottom + 6}px`;
    menu.style.bottom = "";
    if (align === "bottom-right") {
      menu.style.right = `${window.innerWidth - trigger.right}px`;
      menu.style.left = "";
    } else {
      menu.style.left = `${trigger.left}px`;
      menu.style.right = "";
    }
    menu.style.width = `${trigger.width}px`;

    const menuRect = menu.getBoundingClientRect();
    const top =
      menuRect.bottom > window.innerHeight
        ? trigger.top - menuRect.height - 6
        : trigger.bottom + 6;

    setMenuStyle({
      top,
      width: trigger.width,
      ...(align === "bottom-right"
        ? { right: window.innerWidth - trigger.right }
        : { left: trigger.left }),
    });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        menuRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-[36px] items-center justify-between gap-[8px] rounded-md border ${borderClass} ${bgClass} px-[12px] text-[13px] font-[400] text-text-primary transition-colors ${hoverClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/70 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary disabled:pointer-events-none disabled:opacity-50 cursor-pointer ${className}`.trim()}
        style={{ fontFamily: "var(--font-inter), sans-serif" }}
      >
        <span className="inline-flex items-center gap-[7px] truncate min-w-0">
          {selected?.icon && (
            <span className="shrink-0 flex items-center">{selected.icon}</span>
          )}
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <ChevronIcon open={open} />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              key="select-menu"
              ref={menuRef}
              role="listbox"
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.13, ease: "easeOut" }}
              className="fixed z-[9999] overflow-hidden rounded-md border border-border-primary bg-bg-primary p-[6px]"
              style={menuStyle}
            >
              <div className="flex flex-col gap-[2px]">
                {options.map((option) => {
                  const isActive = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-[8px] rounded-md px-[10px] py-[7px] text-[13px] transition-colors ${
                        isActive
                          ? "bg-border-alpha-14 text-text-primary"
                          : "bg-transparent text-text-secondary hover:bg-border-alpha-14 hover:text-text-primary"
                      } border-none cursor-pointer`}
                      style={{
                        fontFamily: "var(--font-inter), sans-serif",
                        fontWeight: isActive ? 500 : 400,
                      }}
                    >
                      <span className="flex items-center gap-[8px] min-w-0">
                        {option.icon && (
                          <span className="shrink-0 flex items-center">
                            {option.icon}
                          </span>
                        )}
                        <ScrollingLabel text={option.label} />
                      </span>
                      {isActive && <CheckIcon />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

export default Select;
