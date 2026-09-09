import { forwardRef } from "react";

export interface TextInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  icon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  size?: "default" | "sm";
  variant?: "default" | "transparent";
  hasError?: boolean;
}

const sizeClasses: Record<NonNullable<TextInputProps["size"]>, string> = {
  default: "h-[44px] px-[14px] text-[14px]",
  sm: "h-[36px] px-[12px] text-[13px]",
};

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      icon,
      rightSlot,
      size = "default",
      variant = "default",
      hasError = false,
      className = "",
      disabled,
      ...props
    },
    ref,
  ) => {
    const isTransparent = variant === "transparent";
    const bgClass =
      className.includes("bg-")
        ? ""
        : isTransparent
          ? "bg-transparent"
          : "bg-bg-primary";

    const borderClass = hasError
      ? "border-accent-primary ring-1 ring-accent-primary"
      : isTransparent
        ? "border-black/15 dark:border-white/20 hover:border-black/25 dark:hover:border-white/35 focus-within:border-black/40 dark:focus-within:border-white/50 focus-within:ring-1 focus-within:ring-black/15 dark:focus-within:ring-white/20"
        : "border-border-primary focus-within:border-text-secondary focus-within:ring-1 focus-within:ring-text-secondary";

    return (
      <div
        className={`group flex items-center gap-[10px] rounded-md border ${bgClass} ${borderClass} transition-[border-color,box-shadow] duration-150 ${disabled ? "opacity-50 pointer-events-none" : ""} ${sizeClasses[size]} ${className}`.trim()}
      >
      {icon && <span className="shrink-0 text-text-secondary">{icon}</span>}
      <input
        ref={ref}
        disabled={disabled}
        className="w-full bg-transparent border-none p-0 text-[inherit] font-[400] text-text-primary placeholder:text-text-tertiary outline-none disabled:cursor-not-allowed [&::-ms-reveal]:hidden [&::-ms-clear]:hidden [&:-webkit-autofill]:shadow-[0_0_0_1000px_var(--bg-primary)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:var(--text-primary)]"
        style={{
          fontFamily: "var(--font-inter), sans-serif",
          letterSpacing: "0",
          lineHeight: "normal",
        }}
        {...props}
      />
      {rightSlot && (
        <div className="shrink-0 flex items-center">{rightSlot}</div>
      )}
      </div>
    );
  },
);

TextInput.displayName = "TextInput";

export default TextInput;
