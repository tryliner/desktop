import type { ReactNode } from "react";
import Button, { type ButtonProps } from "./Button";
import { cn } from "@/shared/lib";

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

/**
 * Title + description block for dialogs, so every modal shares one typography.
 */
export function DialogHeader({
  title,
  description,
  trailing,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-[12px]", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
        <h2
          className="m-0 text-[18px] font-[600] leading-[1.2] tracking-[-0.01em] text-text-primary"
          style={font}
        >
          {title}
        </h2>
        {description && (
          <p
            className="m-0 text-[13px] leading-[1.45] text-text-tertiary"
            style={font}
          >
            {description}
          </p>
        )}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}

/**
 * Telegram-style action row: buttons share one row while their labels fit,
 * otherwise the ones that don't fit wrap to the next row and every row
 * stretches to the full width (2 + 1, 2 + 2, ...).
 */
export function DialogActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-[8px] w-full", className)}>
      {children}
    </div>
  );
}

export interface DialogButtonProps extends Omit<ButtonProps, "variant" | "size"> {
  variant?: "primary" | "secondary" | "danger";
  /** shows a spinner next to the label and blocks clicks */
  loading?: boolean;
}

const variantClass: Record<NonNullable<DialogButtonProps["variant"]>, string> = {
  primary: "",
  secondary:
    "!bg-black/[0.05] dark:!bg-white/[0.08] hover:!bg-black/[0.08] dark:hover:!bg-white/[0.12] !text-text-primary",
  danger: "!bg-accent-secondary !text-white hover:!opacity-90",
};

/**
 * Full-height dialog button. `flex-[1_1_0%]` + `min-w-max` is what makes the
 * row wrap only when a label would not fit, and lets the remaining buttons
 * grow to fill their row.
 */
export function DialogButton({
  variant = "secondary",
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: DialogButtonProps) {
  return (
    <Button
      variant={variant === "primary" ? "primary" : "secondary"}
      disabled={disabled || loading}
      className={cn(
        "flex-[1_1_0%] min-w-max !h-[44px] !rounded-[12px] !border-0 px-[16px] !text-[14px] !font-[500]",
        variantClass[variant],
        loading && "pointer-events-none",
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="inline-block h-[14px] w-[14px] shrink-0 rounded-full border-[2px] border-current border-t-transparent opacity-70 animate-spin"
        />
      )}
      <span className="truncate">{children}</span>
    </Button>
  );
}

export default DialogActions;
