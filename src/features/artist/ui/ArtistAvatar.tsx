import { useState } from "react";
import { cn } from "@/shared/lib/utils";
import type { TrackArtist } from "@/shared/types";
import { useArtistAvatar } from "../hooks/useArtistAvatar";
import { primaryArtistId, sizedAvatarUrl } from "../lib/artistAvatar";

const AVATAR_PIXELS = 96;

export interface ArtistAvatarProps {
  artistId?: string;
  artistList?: TrackArtist[];
  className?: string;
}

export default function ArtistAvatar({
  artistId,
  artistList,
  className,
}: ArtistAvatarProps) {
  const avatar = useArtistAvatar(primaryArtistId(artistId, artistList));
  const url = avatar ? sizedAvatarUrl(avatar, AVATAR_PIXELS) : avatar;
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const loaded = Boolean(url) && url === loadedUrl;

  if (url === null || (url && url === failedUrl)) return null;

  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-block shrink-0 overflow-hidden rounded-full",
        className,
      )}
    >
      <span
        className={cn(
          "absolute inset-0 animate-pulse rounded-full bg-current/20 transition-opacity duration-300",
          loaded && "opacity-0",
        )}
      />
      {url && (
        <img
          key={url}
          src={url}
          alt=""
          draggable={false}
          decoding="async"
          onLoad={() => setLoadedUrl(url)}
          onError={() => setFailedUrl(url)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 ease-out",
            loaded && "opacity-100",
          )}
        />
      )}
    </span>
  );
}
