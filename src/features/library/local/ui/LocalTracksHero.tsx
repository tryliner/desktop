import type { ReactNode } from "react";
import { AddLine, MusicLine, PlayFill } from "@mingcute/react";
import { LuShuffle, LuTrash2 } from "react-icons/lu";
import { useTranslation } from "@/languages";
import {
  EntityHero,
  HERO_BUTTON_CLASS,
  HERO_CHIP_CLASS,
  HERO_GLASS_BUTTON_CLASS,
  HERO_SUBTITLE_CLASS,
  HERO_TITLE_CLASS,
} from "@/shared/ui";
import Button from "@/shared/ui/Button";
import type { Track } from "@/shared/types";
import { formatTotalDuration } from "../lib/formatLocalDurations";
import LocalFilesCover from "./LocalFilesCover";

interface LocalTracksHeroProps {
  tracks: Track[];
  importing: boolean;
  search: ReactNode;
  sort: ReactNode;
  onPlayAll: () => void;
  onShuffle: () => void;
  onAddFiles: () => void;
  onRemoveAll: () => void;
}

export default function LocalTracksHero({
  tracks,
  importing,
  search,
  sort,
  onPlayAll,
  onShuffle,
  onAddFiles,
  onRemoveAll,
}: LocalTracksHeroProps) {
  const { t } = useTranslation();
  const empty = tracks.length === 0;
  const totalMs = tracks.reduce(
    (sum, track) => sum + (track.durationMs || 0),
    0,
  );

  return (
    <EntityHero
      cover={<LocalFilesCover className="absolute inset-0" />}
      title={<h1 className={HERO_TITLE_CLASS}>{t("library.local.title")}</h1>}
      subtitle={
        <p className={HERO_SUBTITLE_CLASS}>{t("library.local.subtitle")}</p>
      }
      meta={
        <div className={HERO_CHIP_CLASS}>
          <MusicLine size={13} className="shrink-0 text-text-secondary" />
          <span>{t("common.songs", { count: tracks.length })}</span>
          {!empty && (
            <>
              <span
                className="h-[3px] w-[3px] shrink-0 rounded-full bg-text-secondary/50"
                aria-hidden
              />
              <span>{formatTotalDuration(totalMs, t)}</span>
            </>
          )}
        </div>
      }
      actions={
        <>
          <Button
            variant="primary"
            onClick={onPlayAll}
            disabled={empty}
            className={`${HERO_BUTTON_CLASS} px-[22px]`}
          >
            <PlayFill size={16} />
            <span>{t("common.play_all")}</span>
          </Button>
          <Button
            variant="secondary"
            onClick={onShuffle}
            disabled={empty}
            className={`${HERO_BUTTON_CLASS} ${HERO_GLASS_BUTTON_CLASS} !w-[52px] !p-0 text-text-primary`}
            title={t("common.shuffle")}
          >
            <LuShuffle size={18} />
          </Button>
        </>
      }
      trailingActions={
        <>
          {search}
          {sort}
          {!empty && (
            <Button
              variant="secondary"
              onClick={onRemoveAll}
              disabled={importing}
              className={`${HERO_BUTTON_CLASS} ${HERO_GLASS_BUTTON_CLASS} !w-[52px] !p-0 text-text-primary`}
              title={t("library.local.remove_all")}
              aria-label={t("library.local.remove_all")}
            >
              <LuTrash2 size={17} />
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={onAddFiles}
            disabled={importing}
            className={`${HERO_BUTTON_CLASS} ${HERO_GLASS_BUTTON_CLASS} px-[22px]`}
          >
            <AddLine
              size={16}
              className={importing ? "animate-pulse" : undefined}
            />
            <span className="truncate">
              {importing
                ? t("library.local.importing")
                : t("library.local.add_files")}
            </span>
          </Button>
        </>
      }
    />
  );
}
