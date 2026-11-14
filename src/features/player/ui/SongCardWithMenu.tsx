import { memo } from "react";
import SongCard from "./SongCard";
import { useSongCardMenu } from "../hooks/useSongCardMenu";

import type { TrackArtist } from "@/shared/types";
import { isLocalTrackId } from "@/shared/media/local";

export interface SongCardWithMenuProps {
  id?: string;
  title: string;
  artists: string;
  artistId?: string;
  artistList?: TrackArtist[];
  coverUrl: string;
  className?: string;
  onPlay?: () => void;
  duration?: string;
  durationMs?: number;
  releaseDate?: string;
  explicit?: boolean;
  hideArtists?: boolean;
  imageShape?: "square" | "circle";
  trackNumber?: number;
  repostedBy?: string;
  searchType?: "track" | "album" | "artist" | "playlist";
  totalTracks?: number;
  playlistId?: string;
  playlistItemId?: string;
  playlistTitle?: string;
  onNavigate?: () => void;
  compact?: boolean;
  icon?: React.ReactNode;
  showReorderHandle?: boolean;
  onGrabStart?: (e: React.PointerEvent<HTMLDivElement>) => void;
  highlight?: string;
  trailingAction?: React.ReactNode;
  /** play queue rows: adds "Remove from queue" to the card menu */
  onRemoveFromQueue?: () => void;
  onRemoveFromDevice?: () => void;
  onRemoveFromPlaylist?: () => Promise<void>;
}

function SongCardWithMenu(props: SongCardWithMenuProps) {
  const {
    id,
    title,
    artists,
    artistId,
    artistList,
    coverUrl,
    className,
    onPlay,
    duration,
    releaseDate,
    explicit,
    hideArtists,
    imageShape,
    trackNumber,
    repostedBy,
    onNavigate,
    compact,
    icon,
    showReorderHandle,
    onGrabStart,
    highlight,
    trailingAction,
  } = props;

  const {
    menuItems,
    menuOpen,
    menuPosition,
    handleDoubleClick,
    handleContextMenu,
    handleMenuOpenChange,
  } = useSongCardMenu(props);

  return (
    <SongCard
      id={id}
      title={title}
      highlight={highlight}
      artists={artists}
      artistId={artistId}
      artistList={artistList}
      artistsClickable={!isLocalTrackId(id)}
      coverUrl={coverUrl}
      className={className}
      onPlay={onPlay}
      onDoubleClick={handleDoubleClick}
      duration={duration}
      releaseDate={releaseDate}
      explicit={explicit}
      hideArtists={hideArtists}
      imageShape={imageShape}
      trackNumber={trackNumber}
      repostedBy={repostedBy}
      menuItems={menuItems}
      menuOpen={menuOpen}
      onMenuOpenChange={handleMenuOpenChange}
      onContextMenu={handleContextMenu}
      menuPosition={menuPosition}
      onNavigate={onNavigate}
      compact={compact}
      icon={icon}
      showReorderHandle={showReorderHandle}
      onGrabStart={onGrabStart}
      trailingAction={trailingAction}
    />
  );
}

export default memo(SongCardWithMenu);
