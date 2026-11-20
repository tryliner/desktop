import { forwardRef, type ReactNode } from "react";
import { PlaylistFill } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { PickerRow } from "./PickerRow";
import type { PickerPlaylist, PickerRows } from "./usePickerRows";

interface PickerListProps {
  rows: PickerRows;
  trackCount: number;
  selected: Set<string>;
  submitting: boolean;
  hasQuery: boolean;
  scrollMask: string | undefined;
  onScroll: (() => void) | undefined;
  onToggle: (id: string) => void;
  onSubmitOne: (id: string) => void;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="px-[8px] pb-[2px] pt-[6px] text-caption font-[500] uppercase tracking-[0.04em] text-text-tertiary">
      {children}
    </span>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="mx-[8px] flex flex-col items-center gap-[8px] rounded-control bg-bg-elevated/60 px-[12px] py-[24px] text-center">
      <span className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-bg-elevated text-text-tertiary">
        <PlaylistFill size={18} />
      </span>
      <p className="m-0 text-body text-text-secondary">
        {hasQuery
          ? t("common.try_another_search_clear")
          : t("common.no_playlists_yet")}
      </p>
    </div>
  );
}

export const PickerList = forwardRef<HTMLDivElement, PickerListProps>(
  function PickerList(props, ref) {
    const { t } = useTranslation();
    const { rows, selected, scrollMask } = props;
    const renderRow = (playlist: PickerPlaylist) => (
      <PickerRow
        key={playlist.id}
        playlist={playlist}
        present={rows.overlap.get(playlist.id)}
        trackCount={props.trackCount}
        checked={selected.has(playlist.id)}
        disabled={props.submitting}
        onToggle={props.onToggle}
        onSubmitOne={props.onSubmitOne}
      />
    );
    const empty = rows.recentRows.length === 0 && rows.otherRows.length === 0;
    return (
      <div
        ref={ref}
        onScroll={props.onScroll}
        style={
          scrollMask
            ? { WebkitMaskImage: scrollMask, maskImage: scrollMask }
            : undefined
        }
        className="flex max-h-[300px] flex-col gap-[2px] overflow-y-auto"
      >
        {empty ? (
          <EmptyState hasQuery={props.hasQuery} />
        ) : (
          <>
            {rows.recentRows.length > 0 && (
              <SectionLabel>{t("playlist_picker.recent")}</SectionLabel>
            )}
            {rows.recentRows.map(renderRow)}
            {rows.recentRows.length > 0 && (
              <SectionLabel>{t("playlist_picker.all_playlists")}</SectionLabel>
            )}
            {rows.otherRows.map(renderRow)}
          </>
        )}
      </div>
    );
  },
);
