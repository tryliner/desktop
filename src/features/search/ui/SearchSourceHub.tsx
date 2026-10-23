import { memo, useState, type ComponentType } from "react";
import { GridFill } from "@mingcute/react";
import {
  SiApplemusic,
  SiDeezer,
  SiSoundcloud,
  SiSpotify,
  SiTidal,
  SiYoutubemusic,
} from "react-icons/si";
import type { CatalogSource } from "@/shared/contracts";
import { DropdownMenu, Tooltip, useToast } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { useSearchSourceStore } from "../store/searchSourceStore";

type SourceIcon = ComponentType<{ size?: number | string; "aria-hidden"?: boolean }>;

const SOURCE_DETAILS: Record<CatalogSource, {
  labelKey: string;
  icon: SourceIcon;
  colorClass: string;
}> = {
  youtube: {
    labelKey: "search.sources.youtube",
    icon: SiYoutubemusic,
    colorClass: "text-[#ff0033]",
  },
  soundcloud: {
    labelKey: "search.sources.soundcloud",
    icon: SiSoundcloud,
    colorClass: "text-[#ff5500]",
  },
};

const COMING_SOON_MESSAGE = "Spotify, Apple Music, TIDAL, and Deezer are coming soon.";

export const SearchSourceHub = memo(function SearchSourceHub() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const enabledSources = useSearchSourceStore((state) => state.enabledSources);
  const selectedSources = useSearchSourceStore((state) => state.selectedSources);
  const toggleSourceSelected = useSearchSourceStore((state) => state.toggleSourceSelected);

  const allEnabledSelected = enabledSources.length === selectedSources.length
    && enabledSources.every((source) => selectedSources.includes(source));
  const sourceState = allEnabledSelected ? "all" : selectedSources[0] ?? "all";
  const TriggerIcon = sourceState === "all" ? GridFill : SOURCE_DETAILS[sourceState].icon;
  const sourceClass = sourceState === "youtube"
    ? "bg-[#ff0033]/15 text-[#ff0033] hover:bg-[#ff0033]/20"
    : sourceState === "soundcloud"
      ? "bg-[#ff5500]/15 text-[#ff5500] hover:bg-[#ff5500]/20"
      : "bg-border-alpha-14 text-text-secondary hover:bg-border-alpha-20 hover:text-text-primary";
  const sourcesLabel = t("search.sources.label") || "Sources";

  const items = [
    ...enabledSources.map((source) => {
      const details = SOURCE_DETAILS[source];
      const Icon = details.icon;
      const checked = selectedSources.includes(source);
      return {
        id: source,
        label: t(details.labelKey),
        checked,
        closeOnSelect: false,
        icon: <Icon size={16} aria-hidden />,
        onClick: () => toggleSourceSelected(source),
      };
    }),
    {
      id: "coming-soon",
      label: t("search.sources.coming_soon") || "More sources coming soon",
      separatorBefore: true,
      icon: (
        <span className="flex items-center gap-1 text-text-tertiary" aria-hidden="true">
          <SiSpotify size={11} />
          <SiApplemusic size={11} />
          <SiTidal size={11} />
          <SiDeezer size={11} />
        </span>
      ),
      onClick: () => {
        toast(t("search.sources.coming_soon_message") || COMING_SOON_MESSAGE, "info");
      },
    },
  ];

  return (
    <Tooltip content={sourcesLabel} side="bottom">
      <DropdownMenu
        open={open}
        onOpenChange={setOpen}
        align="end"
        trigger={(
          <button
            type="button"
            aria-label={sourcesLabel}
            aria-haspopup="menu"
            aria-expanded={open}
            data-source-state={sourceState}
            className={`flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-full border-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary ${sourceClass}`}
          >
            <TriggerIcon size={15} aria-hidden />
          </button>
        )}
        items={items}
      />
    </Tooltip>
  );
});

export default SearchSourceHub;
