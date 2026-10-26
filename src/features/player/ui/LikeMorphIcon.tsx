import { MorphIcon } from "morphicons/react";
import type { IconNode } from "morphicons/react";

const ICON_PLUS: IconNode = [
  ["path", { d: "M5 12H19" }],
  ["path", { d: "M12 5V19" }],
];

const ICON_CHECK: IconNode = [
  ["path", { d: "M4.5 12.5L9.5 17.5" }],
  ["path", { d: "M9.5 17.5L19.5 6.5" }],
];

interface LikeMorphIconProps {
  liked: boolean;
  size: number;
}

export function LikeMorphIcon({ liked, size }: LikeMorphIconProps) {
  return (
    <MorphIcon
      icon={liked ? ICON_CHECK : ICON_PLUS}
      size={size}
      spring="snappy"
      reducedMotion="user"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
