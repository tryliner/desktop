import type { SVGProps } from "react";

export interface ResetIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

/**
 * Clockwise reset / undo-reversed icon sourced from user asset,
 * reversed (mirrored horizontally) and centered optically in a 32x32 bounding box.
 */
export function ResetIcon({
  size = 13,
  className = "",
  style,
  ...props
}: ResetIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
      className={`shrink-0 relative ${className || "-top-[1px]"}`.trim()}
      style={{ display: "block", ...style }}
      {...props}
    >
      <g transform="translate(32, 0) scale(-1, 1)">
        <path d="M29,18c0,3.472-1.353,6.737-3.808,9.193C22.736,29.648,19.472,31,16,31 c-3.473,0-6.737-1.353-9.192-3.808S3,21.472,3,18c0-1.104,0.896-2,2-2s2,0.896,2,2c0,2.403,0.937,4.664,2.636,6.364 C11.336,26.064,13.596,27,16,27c2.403,0,4.664-0.936,6.364-2.636C24.063,22.664,25,20.404,25,18s-0.937-4.664-2.636-6.364 C20.664,9.936,18.404,9,16,9h-2.172l1.586,1.586c0.781,0.781,0.781,2.047,0,2.828s-2.047,0.781-2.828,0l-5-5 c-0.781-0.781-0.781-2.047,0-2.828l5-5c0.781-0.781,2.047-0.781,2.828,0s0.781,2.047,0,2.828L13.828,5H16 c3.473,0,6.737,1.353,9.192,3.808C27.647,11.263,29,14.528,29,18z" />
      </g>
    </svg>
  );
}

export default ResetIcon;
