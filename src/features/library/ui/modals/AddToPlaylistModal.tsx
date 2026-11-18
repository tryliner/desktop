import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  PlaylistFill,
  Search2Line,
  CloseCircleFill,
  AddLine,
  CheckLine,
} from "@mingcute/react";
import TextInput from "@/shared/ui/TextInput";
import Dialog from "@/shared/ui/Dialog";
import { DialogActions, DialogButton, useToast } from "@/shared/ui";
import CoverImage from "@/features/covers/ui/CoverImage";
import { useTranslation } from "@/languages";
import {
  cachedPlaylistOverlap,
  useCreatePlaylist,
  usePlaylistsList,
} from "../../hooks";
import { useModalStore, type TrackDetail } from "../../store/modalStore";
import {
  addTracksToPlaylists,
  rememberRecentPlaylists,
  sortByRecent,
} from "../../services/addToPlaylists";
import { useRecentPlaylists } from "../../hooks/useRecentPlaylists";
import { reportAddResult } from "../../lib/addToPlaylistsFeedback";

const TITLE_MAX = 20;
const SEARCH_THRESHOLD = 5;

function SelectionHeader({ tracks }: { tracks: TrackDetail[] }) {
  const { t } = useTranslation();
  const first = tracks[0];
  if (!first) return null;
  const many = tracks.length > 1;
  const covers = tracks
    .map((track) => track.coverUrl)
    .filter(Boolean)
    .slice(0, 3);
  return (
    <div className="mt-[10px] flex items-center gap-[10px] rounded-control bg-bg-elevated/60 px-[10px] py-[8px]">
      <div className="relative h-[40px] w-[40px] shrink-0">
        {many && covers.length > 1 ? (
          covers
            .slice()
            .reverse()
            .map((url, index, arr) => {
              const depth = arr.length - 1 - index;
              return (
                <div
                  key={`${url}-${index}`}
                  className="absolute inset-0 overflow-hidden rounded-control bg-bg-elevated shadow-sm"
                  style={{
                    transform: `translate(${depth * 3}px, ${-depth * 3}px) scale(${1 - depth * 0.08})`,
                    opacity: 1 - depth * 0.25,
                  }}
                >
                  <CoverImage
                    src={url}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </div>
              );
            })
        ) : (
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-control bg-bg-elevated">
            {first.coverUrl ? (
              <CoverImage
                src={first.coverUrl}
                alt={first.title}
                fill
                sizes="40px"
                className="object-cover"
              />
            ) : (
              <span className="text-title font-[600] text-text-tertiary">
                {first.title.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
        <span className="truncate text-body font-[500] text-text-primary">
          {many ? t("selection.count", { count: tracks.length }) : first.title}
        </span>
        <span className="truncate text-caption text-text-tertiary">
          {many
            ? tracks
                .slice(0, 3)
                .map((track) => track.title)
                .join(", ") + (tracks.length > 3 ? "…" : "")
            : first.artists}
        </span>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-[8px] pb-[2px] pt-[6px] text-caption font-[500] uppercase tracking-[0.04em] text-text-tertiary">
      {children}
    </span>
  );
}

/**
 * Picker for one track or a multi-selection. Rows are checkboxes so a song
 * can go to several playlists in one go; double-click a row to add straight
 * to that playlist.
 */
export default function AddToPlaylistModal() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const open = useModalStore((state) => state.addToPlaylistOpen);
  const tracks = useModalStore((state) => state.addToPlaylistTracks);
  const close = useModalStore((state) => state.closeAddToPlaylist);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [scrollMask, setScrollMask] = useState(
    "linear-gradient(to bottom, black 0%, black 100%)",
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: playlistData } = usePlaylistsList();
  const createPlaylist = useCreatePlaylist();
  const recent = useRecentPlaylists();

  const trackIds = useMemo(() => tracks.map((track) => track.id), [tracks]);

  const rawPlaylists = useMemo(
    () =>
      sortByRecent(
        playlistData?.playlists?.length
          ? playlistData.playlists
          : (tracks[0]?.playlists ?? []),
        recent,
      ),
    [playlistData?.playlists, tracks, recent],
  );

  const playlists = useMemo(() => {
    if (!searchQuery.trim()) return rawPlaylists;
    const q = searchQuery.toLowerCase().trim();
    return rawPlaylists.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description ? p.description.toLowerCase().includes(q) : false),
    );
  }, [rawPlaylists, searchQuery]);

  const recentSet = useMemo(() => new Set(recent), [recent]);
  const showSections =
    !searchQuery.trim() &&
    rawPlaylists.length >= SEARCH_THRESHOLD &&
    playlists.some((p) => recentSet.has(p.id)) &&
    playlists.some((p) => !recentSet.has(p.id));

  // read from already-cached playlist details only, never fetched here
  const overlap = useMemo(() => {
    const map = new Map<string, number | undefined>();
    if (!open) return map;
    for (const playlist of rawPlaylists) {
      map.set(playlist.id, cachedPlaylistOverlap(playlist.id, trackIds));
    }
    return map;
  }, [open, rawPlaylists, trackIds]);

  const updateScrollMask = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    const top =
      scrollTop > 4 ? "transparent 0%, black 6%, " : "black 0%, black 6%, ";
    const bottom =
      scrollTop + clientHeight < scrollHeight - 4
        ? "black 94%, transparent 100%"
        : "black 94%, black 100%";
    setScrollMask(`linear-gradient(to bottom, ${top}${bottom})`);
  }, []);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelected(new Set());
      setCreating(false);
      setNewTitle("");
    }
  }, [open]);

  useEffect(() => {
    if (rawPlaylists.length >= SEARCH_THRESHOLD) updateScrollMask();
  }, [open, rawPlaylists.length, playlists.length, updateScrollMask]);

  const toggle = (playlistId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playlistId)) next.delete(playlistId);
      else next.add(playlistId);
      return next;
    });
  };

  const submit = async (ids: string[]) => {
    if (submitting || ids.length === 0 || tracks.length === 0) return;
    setSubmitting(true);
    try {
      const result = await addTracksToPlaylists(tracks, ids);
      if (result.added > 0 || result.alreadyIn > 0) {
        rememberRecentPlaylists(ids);
      }
      reportAddResult(
        result,
        new Map(rawPlaylists.map((p) => [p.id, p.title])),
        tracks.length,
        t,
      );
      // keep the picker open only when nothing went through, so the user can retry
      if (result.failed === 0 || result.added > 0) close();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title || createPlaylist.isPending) return;
    try {
      const playlist = await createPlaylist.mutateAsync({
        title: title.slice(0, TITLE_MAX),
      });
      setSelected((prev) => new Set(prev).add(playlist.id));
      rememberRecentPlaylists([playlist.id]);
      setCreating(false);
      setNewTitle("");
      setSearchQuery("");
      scrollRef.current?.scrollTo({ top: 0 });
    } catch {
      toast(t("common.failed_create_playlist"), "error");
    }
  };

  const renderRow = (playlist: (typeof playlists)[number]) => {
    const present = overlap.get(playlist.id);
    const fullyAdded = present !== undefined && present === tracks.length;
    const partly = present !== undefined && present > 0 && !fullyAdded;
    const checked = selected.has(playlist.id);
    return (
      <button
        key={playlist.id}
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={submitting}
        onClick={() => toggle(playlist.id)}
        onDoubleClick={() => void submit([playlist.id])}
        className={`group flex w-full cursor-pointer items-center gap-[12px] rounded-control border-none p-[8px] text-left transition-colors disabled:opacity-50 ${
          checked
            ? "bg-bg-elevated"
            : "bg-transparent hover:bg-bg-elevated active:bg-border-alpha-14"
        }`}
      >
        <div className="relative flex h-[44px] w-[44px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg-elevated">
          {playlist.coverUrl ? (
            <CoverImage
              src={playlist.coverUrl}
              alt={playlist.title}
              fill
              sizes="44px"
              className="object-cover"
            />
          ) : (
            <PlaylistFill size={20} className="text-text-tertiary" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
          <span className="truncate text-body font-[500] text-text-primary">
            {playlist.title}
          </span>
          <span className="truncate text-caption tabular-nums text-text-tertiary">
            {fullyAdded
              ? t("playlist_picker.already_added")
              : partly
                ? t("playlist_picker.partly_added", { count: present ?? 0 })
                : t("common.tracks", { count: playlist.trackCount })}
          </span>
        </div>

        <span
          aria-hidden
          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
            checked
              ? "border-text-primary bg-text-primary text-bg-canvas"
              : "border-border-alpha-14 text-transparent group-hover:border-text-tertiary"
          }`}
        >
          <CheckLine size={14} />
        </span>
      </button>
    );
  };

  const recentRows = showSections
    ? playlists.filter((p) => recentSet.has(p.id))
    : [];
  const otherRows = showSections
    ? playlists.filter((p) => !recentSet.has(p.id))
    : playlists;
  const searchable = rawPlaylists.length >= SEARCH_THRESHOLD;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? close() : undefined)}
      maxWidth={400}
    >
      {/* outer gutters live here (12px); rows bleed only 8px on hover so
          cover art sits at the same 20px inset as the header text */}
      <div
        className="flex flex-col gap-[12px] px-[12px] pb-[12px]"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !creating && selected.size > 0) {
            e.preventDefault();
            void submit([...selected]);
          }
        }}
      >
        <div className="px-[8px] pt-[4px]">
          <h2 className="m-0 text-heading font-[600] tracking-[-0.01em] text-text-primary">
            {t("playlist_picker.title", { count: tracks.length })}
          </h2>
          <SelectionHeader tracks={tracks} />
        </div>

        {searchable && (
          <div className="px-[8px]">
            <TextInput
              size="sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("library.search_playlists")}
              icon={<Search2Line size={16} />}
              rightSlot={
                searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="flex cursor-pointer items-center justify-center border-none bg-transparent p-0 text-text-tertiary hover:text-text-primary"
                  >
                    <CloseCircleFill size={15} />
                  </button>
                ) : null
              }
              className="!h-[36px] w-full rounded-control !border-transparent bg-bg-elevated text-body"
            />
          </div>
        )}

        {creating && (
          <div className="flex items-center gap-[8px] px-[8px]">
            <TextInput
              size="sm"
              autoFocus
              value={newTitle}
              maxLength={TITLE_MAX}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleCreate();
                } else if (e.key === "Escape") {
                  e.stopPropagation();
                  setCreating(false);
                }
              }}
              placeholder={t("playlist_picker.new_playlist")}
              className="!h-[36px] w-full rounded-control !border-transparent bg-bg-elevated text-body"
            />
          </div>
        )}

        <div
          ref={scrollRef}
          onScroll={searchable ? updateScrollMask : undefined}
          style={
            searchable
              ? { WebkitMaskImage: scrollMask, maskImage: scrollMask }
              : undefined
          }
          className="flex max-h-[300px] flex-col gap-[2px] overflow-y-auto"
        >
          {playlists.length > 0 ? (
            <>
              {recentRows.length > 0 && (
                <SectionLabel>{t("playlist_picker.recent")}</SectionLabel>
              )}
              {recentRows.map(renderRow)}
              {recentRows.length > 0 && (
                <SectionLabel>
                  {t("playlist_picker.all_playlists")}
                </SectionLabel>
              )}
              {otherRows.map(renderRow)}
            </>
          ) : (
            <div className="mx-[8px] flex flex-col items-center gap-[8px] rounded-control bg-bg-elevated/60 px-[12px] py-[24px] text-center">
              <span className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-bg-elevated text-text-tertiary">
                <PlaylistFill size={18} />
              </span>
              <p className="m-0 text-body text-text-secondary">
                {searchQuery
                  ? t("common.try_another_search_clear")
                  : t("common.no_playlists_yet")}
              </p>
            </div>
          )}
        </div>

        <div className="px-[8px] pb-[8px]">
          <DialogActions>
            {creating ? (
              <DialogButton
                type="button"
                loading={createPlaylist.isPending}
                disabled={!newTitle.trim()}
                onClick={() => void handleCreate()}
              >
                {t("library.create_playlist")}
              </DialogButton>
            ) : (
              <DialogButton type="button" onClick={() => setCreating(true)}>
                <span className="inline-flex items-center gap-[6px]">
                  <AddLine size={16} />
                  {t("playlist_picker.new_playlist")}
                </span>
              </DialogButton>
            )}
            <DialogButton
              type="button"
              variant="primary"
              loading={submitting}
              disabled={selected.size === 0}
              onClick={() => void submit([...selected])}
            >
              {selected.size > 0
                ? t("playlist_picker.add_to", { count: selected.size })
                : t("playlist_picker.pick_playlists")}
            </DialogButton>
          </DialogActions>
        </div>
      </div>
    </Dialog>
  );
}
