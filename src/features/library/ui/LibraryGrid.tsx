import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AlbumCard from "@/features/collection/ui/AlbumCard";
import PlaylistCard from "./PlaylistCard";
import CoverImage from "@/features/covers/ui/CoverImage";
import DropdownMenu, { type DropdownMenuItem } from "@/shared/ui/DropdownMenu";
import type {
  LibraryItemViewModel,
  LibraryTab,
  LibraryViewMode,
} from "../types";
import { useTranslation } from "@/languages";
import { useModalStore } from "../store/modalStore";
import { LuTrash2 } from "react-icons/lu";
import {
  More2Fill,
  PlaylistFill,
  DiscLine,
  User1Line,
  Search2Line,
  AddLine,
  Search3Fill,
} from "@mingcute/react";

interface LibraryGridProps {
  items: LibraryItemViewModel[];
  loadingMore: boolean;
  hasMore: boolean;
  hasSearchQuery: boolean;
  activeTab: LibraryTab;
  viewMode?: LibraryViewMode;
  sentinelRef: (node: HTMLDivElement | null) => void;
  prependNode?: React.ReactNode;
}

function LoadingSkeletonGrid({ circle = false }: { circle?: boolean }) {
  return (
    <div className="flex flex-col gap-[8px]">
      <div
        className={`aspect-square w-full animate-pulse bg-border-alpha-14 ${
          circle ? "rounded-full" : "rounded-md"
        }`}
      />
      <div className="h-[13px] w-[78%] animate-pulse rounded bg-border-alpha-33" />
      <div className="h-[11px] w-[56%] animate-pulse rounded bg-border-alpha-14" />
    </div>
  );
}

function LoadingSkeletonList() {
  return (
    <div className="flex items-center gap-[14px] p-[8px] rounded-lg">
      <div className="h-[48px] w-[48px] shrink-0 animate-pulse rounded-md bg-border-alpha-14" />
      <div className="flex flex-col gap-[6px] flex-1">
        <div className="h-[14px] w-[35%] animate-pulse rounded bg-border-alpha-33" />
        <div className="h-[12px] w-[20%] animate-pulse rounded bg-border-alpha-14" />
      </div>
    </div>
  );
}

function useItemMenuItems(item: LibraryItemViewModel): DropdownMenuItem[] {
  const { t } = useTranslation();
  return useMemo(() => {
    const entityType =
      item.kind === "artist"
        ? "artist"
        : item.kind === "album"
          ? "album"
          : "playlist";
    return [
      {
        id: "remove-from-library",
        label: t("common.remove_from_library"),
        icon: <LuTrash2 size={15} />,
        danger: true,
        onClick: () => {
          useModalStore.getState().openRemoveFromLibrary({
            id: item.id,
            title: item.title,
            coverUrl: item.imageUrl,
            type: entityType,
            subtitle: item.subtitle,
          });
        },
      },
    ];
  }, [item.id, item.title, item.imageUrl, item.subtitle, item.kind, t]);
}

function LibraryItemCard({ item }: { item: LibraryItemViewModel }) {
  const menuItems = useItemMenuItems(item);

  if (item.kind === "album") {
    return (
      <AlbumCard
        id={item.id}
        title={item.title}
        coverUrl={item.imageUrl}
        trackCount={item.trackCount}
        menuItems={menuItems}
      />
    );
  }

  return (
    <PlaylistCard
      title={item.title}
      author={item.subtitle}
      imageUrl={item.imageUrl}
      coverUrls={item.coverUrls}
      variant={item.kind === "artist" ? "artist" : "playlist"}
      href={item.href}
      menuItems={menuItems}
    />
  );
}

function LibraryItemRow({ item }: { item: LibraryItemViewModel }) {
  const menuItems = useItemMenuItems(item);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (menuItems.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      setMenuPosition({ x: e.clientX, y: e.clientY });
      setMenuOpen(true);
    },
    [menuItems],
  );

  return (
    <div
      onContextMenu={handleContextMenu}
      onClick={() => navigate(item.href)}
      className="w-full flex items-center justify-between rounded-md p-[8px] outline-none transition-colors duration-150 ease-out cursor-pointer hover:bg-border-alpha-14 select-none"
    >
      <div className="flex items-center gap-[16px] min-w-0">
        <div
          className={`relative h-[48px] w-[48px] shrink-0 overflow-hidden bg-border-alpha-14 ${
            item.kind === "artist" ? "rounded-full" : "rounded-md"
          }`}
        >
          {item.imageUrl ? (
            <CoverImage
              src={item.imageUrl}
              alt={item.title}
              fill
              sizes="48px"
              placeholder="blur"
              blurDataURL="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjMTIxMjEyIi8+PC9zdmc+"
              className="object-cover pointer-events-none"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-text-tertiary">
              <PlaylistFill size={20} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex flex-col gap-[2px]">
          <h3
            className="m-0 max-w-[min(52vw,560px)] overflow-hidden text-ellipsis whitespace-nowrap text-[16px] leading-[1.2] text-text-primary"
            style={{
              fontFamily: "var(--font-inter), sans-serif",
              fontWeight: 400,
            }}
            title={item.title}
          >
            {item.title}
          </h3>
          <p
            className="m-0 flex min-w-0 items-center text-[15px] leading-[1.2] overflow-hidden text-text-secondary"
            style={{
              fontFamily: "var(--font-inter), sans-serif",
              fontWeight: 350,
            }}
          >
            {item.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center shrink-0 ml-[16px] gap-[16px]">
        {item.trackCount !== undefined && (
          <span
            className="text-[14px] text-text-tertiary"
            style={{
              fontFamily: "var(--font-inter), sans-serif",
              fontWeight: 400,
            }}
          >
            {item.trackCount === 1
              ? `1 ${t("library.track")}`
              : `${item.trackCount.toLocaleString()} ${t("library.tracks")}`}
          </span>
        )}

        {menuItems.length > 0 && (
          <DropdownMenu
            trigger={
              <button
                type="button"
                aria-label={t("common.more_options")}
                className="rounded-md bg-transparent border-0 p-0 text-text-primary transition-all duration-200 active:scale-[0.96] flex items-center justify-center cursor-pointer opacity-70 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
              >
                <More2Fill size={22} />
              </button>
            }
            items={menuItems}
            open={menuOpen}
            onOpenChange={setMenuOpen}
            position={menuPosition}
          />
        )}
      </div>
    </div>
  );
}

function EmptyLibraryState({
  activeTab,
  hasSearchQuery,
}: {
  activeTab: LibraryTab;
  hasSearchQuery: boolean;
}) {
  const { t } = useTranslation();

  if (hasSearchQuery) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-[6px] text-center px-[20px]">
        <h3 className="m-0 text-[17px] font-[500] text-text-primary">
          {t("common.no_results")}
        </h3>
        <p className="m-0 text-[13px] text-text-tertiary max-w-[320px]">
          {t("common.try_another_search_clear")}
        </p>
      </div>
    );
  }

  if (activeTab === "playlists") {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-[14px] text-center px-[20px]">
        <div className="flex flex-col gap-[6px] max-w-[360px]">
          <h3 className="m-0 text-[18px] font-[500] text-text-primary">
            {t("library.no_playlists_title")}
          </h3>
          <p className="m-0 text-[13px] text-text-tertiary leading-relaxed">
            {t("library.no_playlists_desc")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => useModalStore.getState().openCreatePlaylist()}
          className="inline-flex items-center gap-[6px] !h-[36px] rounded-lg px-[16px] text-[13px] font-[500] bg-btn-primary-bg text-btn-primary-text hover:opacity-90 active:scale-[0.96] transition-all border-0 cursor-pointer mt-[2px]"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          <AddLine size={16} />
          <span>{t("library.create_playlist")}</span>
        </button>
      </div>
    );
  }

  if (activeTab === "albums") {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-[14px] text-center px-[20px]">
        <div className="flex flex-col gap-[6px] max-w-[360px]">
          <h3 className="m-0 text-[18px] font-[500] text-text-primary">
            {t("library.no_albums_title")}
          </h3>
          <p className="m-0 text-[13px] text-text-tertiary leading-relaxed">
            {t("library.no_albums_desc")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => useModalStore.getState().openSearch()}
          className="inline-flex items-center gap-[6px] !h-[36px] rounded-lg px-[16px] text-[13px] font-[500] bg-bg-elevated border border-border-primary text-text-primary hover:bg-border-alpha-14 active:scale-[0.96] transition-all cursor-pointer mt-[2px]"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          <Search3Fill size={15} />
          <span>{t("library.search_music")}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-[14px] text-center px-[20px]">
      <div className="flex flex-col gap-[6px] max-w-[360px]">
        <h3 className="m-0 text-[18px] font-[500] text-text-primary">
          {t("library.no_artists_title")}
        </h3>
        <p className="m-0 text-[13px] text-text-tertiary leading-relaxed">
          {t("library.no_artists_desc")}
        </p>
      </div>
      <button
        type="button"
        onClick={() => useModalStore.getState().openSearch()}
        className="inline-flex items-center gap-[6px] !h-[36px] rounded-lg px-[16px] text-[13px] font-[500] bg-bg-elevated border border-border-primary text-text-primary hover:bg-border-alpha-14 active:scale-[0.96] transition-all cursor-pointer mt-[2px]"
        style={{ fontFamily: "var(--font-inter), sans-serif" }}
      >
        <Search3Fill size={15} />
        <span>{t("library.search_music")}</span>
      </button>
    </div>
  );
}

interface LibraryGridProps {
  items: LibraryItemViewModel[];
  loadingMore: boolean;
  hasMore: boolean;
  hasSearchQuery: boolean;
  activeTab: LibraryTab;
  viewMode?: LibraryViewMode;
  sentinelRef: (node: HTMLDivElement | null) => void;
  prependNode?: React.ReactNode;
  prependNodes?: React.ReactNode[];
}

export default function LibraryGrid({
  items,
  loadingMore,
  hasMore,
  hasSearchQuery,
  activeTab,
  viewMode = "grid",
  sentinelRef,
  prependNode,
  prependNodes,
}: LibraryGridProps) {
  const prepends = useMemo(() => {
    if (prependNodes && prependNodes.length > 0) return prependNodes;
    if (prependNode) return [prependNode];
    return [];
  }, [prependNode, prependNodes]);

  if (items.length === 0 && prepends.length === 0) {
    return (
      <EmptyLibraryState
        activeTab={activeTab}
        hasSearchQuery={hasSearchQuery}
      />
    );
  }

  if (viewMode === "list") {
    return (
      <div className="flex flex-col gap-[4px] pb-[24px] -mx-[8px]">
        {prepends.map((node, index) => (
          <div key={`prepend-${index}`} className="w-full">
            {node}
          </div>
        ))}
        {items.map((item) => (
          <LibraryItemRow key={`${item.kind}:${item.id}`} item={item} />
        ))}

        {loadingMore
          ? Array.from({ length: 4 }, (_, index) => (
              <LoadingSkeletonList key={`loader-${index}`} />
            ))
          : null}

        {hasMore ? (
          <div ref={sentinelRef} className="h-[2px] w-full" />
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(165px,1fr))] gap-[24px] pb-[24px]">
      {prepends.map((node, index) => (
        <div
          key={`prepend-${index}`}
          className="w-full transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
        >
          {node}
        </div>
      ))}
      {items.map((item) => (
        <div
          key={`${item.kind}:${item.id}`}
          className="w-full transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
        >
          <LibraryItemCard item={item} />
        </div>
      ))}

      {loadingMore
        ? Array.from({ length: 6 }, (_, index) => (
            <div key={`loader-${index}`} className="w-full">
              <LoadingSkeletonGrid
                circle={items[index]?.kind === "artist"}
              />
            </div>
          ))
        : null}

      {hasMore ? <div ref={sentinelRef} className="h-[2px] w-full" /> : null}
    </div>
  );
}

