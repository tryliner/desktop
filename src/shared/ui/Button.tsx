import { forwardRef } from "react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "secondary" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-btn-primary-bg text-btn-primary-text border border-border-primary hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/70 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary",
  secondary:
    "bg-border-alpha-14 text-text-primary hover:bg-border-alpha-33 border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/70 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary",
  outline:
    "border border-border-alpha-14 bg-transparent text-text-primary hover:bg-border-alpha-14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/70 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary",
  ghost:
    "bg-transparent text-text-secondary hover:text-text-primary border border-transparent hover:bg-border-alpha-14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/70 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "h-[44px] px-[18px] py-[8px]",
  sm: "h-[36px] px-[14px] text-[13px]",
  lg: "h-[52px] px-[24px] text-[15px]",
  icon: "h-[44px] w-[44px]",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "default",
      className = "",
      children,
      ...rest
    },
    ref,
  ) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-[8px] rounded-md text-[14px] font-[500] transition-all duration-150 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 cursor-pointer ${
        variantClasses[variant]
      } ${sizeClasses[size]} ${className}`.trim()}
      style={{
        fontFamily: "var(--font-inter), sans-serif",
        letterSpacing: "0",
        lineHeight: "normal",
      }}
      {...rest}
    >
      {children}
    </button>
  ),
);

Button.displayName = "Button";

export default Button;
