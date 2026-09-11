import { memo } from "react";

interface ReorderDropPlaceholderProps {
  className?: string;
  style?: React.CSSProperties;
}

function ReorderDropPlaceholder({
  className = "",
  style,
}: ReorderDropPlaceholderProps) {
  return (
    <div
      style={style}
      className={`w-full h-full rounded-md bg-border-alpha-14 pointer-events-none select-none transition-opacity duration-150 ${className}`}
    />
  );
}

export default memo(ReorderDropPlaceholder);
