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
      className={`inline-flex shrink-0 ${dim} items-center justify-center rounded-[2px] bg-text-tertiary pb-px ${fontSize} font-[800] leading-none text-bg-primary ${className}`}
    >
      E
    </span>
  );
}

export default ExplicitBadge;
