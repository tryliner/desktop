export interface ExplicitBadgeProps {
  size?: "sm" | "md";
  className?: string;
}

export function ExplicitBadge({
  size = "sm",
  className = "",
}: ExplicitBadgeProps) {
  const dim = size === "md" ? "h-[15px] w-[15px]" : "h-[13px] w-[13px]";
  const fontSize = size === "md" ? "text-[10px]" : "text-[9px]";

  return (
    <span
      className={`inline-flex shrink-0 ${dim} items-center justify-center rounded-[3px] bg-black/[0.1] dark:bg-white/[0.14] pb-px ${fontSize} font-[700] leading-none text-text-secondary ${className}`}
    >
      E
    </span>
  );
}

export default ExplicitBadge;
