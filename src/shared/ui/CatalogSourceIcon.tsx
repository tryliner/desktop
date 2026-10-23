import { memo } from "react";
import { SiSoundcloud, SiYoutubemusic } from "react-icons/si";
import type { CatalogSource } from "@/shared/contracts";
import { safeSoundCloudExternalUrl } from "@/shared/media/soundcloud/soundcloudExternalUrl";
import { useTranslation } from "@/languages";

export interface CatalogSourceIconProps {
  source?: CatalogSource;
  externalUrl?: string;
}

export const CatalogSourceIcon = memo(function CatalogSourceIcon({
  source,
  externalUrl,
}: CatalogSourceIconProps) {
  const { t } = useTranslation();
  if (!source) return null;

  const label = t(`search.sources.${source}`);
  const Icon = source === "soundcloud" ? SiSoundcloud : SiYoutubemusic;
  const safeExternalUrl = source === "soundcloud"
    ? safeSoundCloudExternalUrl(externalUrl)
    : undefined;
  const content = <Icon size={12} aria-hidden />;
  const sourceClass = source === "soundcloud"
    ? "text-[#ff5500]"
    : "text-[#ff0033]";
  const className = `inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center transition-opacity ${sourceClass}`;

  if (!safeExternalUrl) {
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        data-source-badge={source}
        data-prevent-drag
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        className={className}
      >
        {content}
      </span>
    );
  }

  return (
    <a
      href={safeExternalUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("search.open_on_source", { source: label })}
      title={t("search.open_on_source", { source: label })}
      data-source-badge={source}
      data-prevent-drag
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") event.stopPropagation();
      }}
      className={`${className} no-underline hover:opacity-75 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary`}
    >
      {content}
    </a>
  );
});

export default CatalogSourceIcon;
