import { YoutubeFill } from "@mingcute/react";
import { IconBadge } from "@/shared/ui";
import type { LibraryItemSource } from "../types";

export interface SourceBadgeProps {
  source?: LibraryItemSource;
  size?: "sm" | "md";
}

export default function SourceBadge({ source, size = "sm" }: SourceBadgeProps) {
  if (source !== "youtube") return null;
  return (
    <IconBadge
      icon={<YoutubeFill size={size === "md" ? 11 : 9} />}
      label="YouTube Music"
      size={size}
    />
  );
}
