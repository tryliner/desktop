import type { SVGProps } from "react";

export default function GrabberIcon({
  size = 18,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      {...props}
    >
      <line x1="3.5" y1="5.5" x2="16.5" y2="5.5" />
      <line x1="3.5" y1="10" x2="16.5" y2="10" />
      <line x1="3.5" y1="14.5" x2="16.5" y2="14.5" />
    </svg>
  );
}
