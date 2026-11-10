import type { ReactNode } from "react";
import CoverImage from "@/features/covers/ui/CoverImage";

// the photo fades out into the page instead of ending on an edge
const BANNER_FADE =
  "linear-gradient(to bottom, black 0%, black 35%, transparent 100%)";

export interface ArtistBannerProps {
  imageUrl?: string;
  alt: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

/** Artist hero: the photo across the full page width with the name, audience and actions at its bottom. */
export default function ArtistBanner({
  imageUrl,
  alt,
  title,
  subtitle,
  actions,
}: ArtistBannerProps) {
  return (
    <section
      data-no-window-drag
      className="relative flex min-h-[340px] w-full min-w-0 flex-col justify-end overflow-hidden"
    >
      <div
        className={`pointer-events-none absolute inset-0 overflow-hidden ${imageUrl ? "" : "bg-bg-elevated"}`}
        style={{ maskImage: BANNER_FADE, WebkitMaskImage: BANNER_FADE }}
      >
        {imageUrl ? (
          <CoverImage
            src={imageUrl}
            alt={alt}
            fill
            sizes="100vw"
            className="object-cover object-center"
            draggable={false}
          />
        ) : null}
      </div>

      <div className="relative flex min-w-0 flex-col pl-[16px] pr-[12px] pb-[20px]">
        <div className="min-w-0">{title}</div>
        {subtitle && <div className="mt-[6px] min-w-0">{subtitle}</div>}
        {actions && (
          <div className="mt-[16px] flex items-center gap-[8px]">{actions}</div>
        )}
      </div>
    </section>
  );
}
