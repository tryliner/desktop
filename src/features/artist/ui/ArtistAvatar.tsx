import { useState, type CSSProperties } from "react";
import { cn } from "@/shared/lib/utils";
import type { TrackArtist } from "@/shared/types";
import { useArtistAvatar } from "../hooks/useArtistAvatar";
import {
  AVATAR_PIXELS,
  avatarArtistIds,
  sizedAvatarUrl,
} from "../lib/artistAvatar";

const STACK_OVERLAP = 0.35;
const STACK_GAP_PX = 1.5;

export interface ArtistAvatarProps {
  artistId?: string;
  artistList?: TrackArtist[];
  size: number;
  className?: string;
}

function useAvatarUrl(artistId?: string): string | null | undefined {
  const avatar = useArtistAvatar(artistId);
  return avatar ? sizedAvatarUrl(avatar, AVATAR_PIXELS) : avatar;
}

function cutoutMask(size: number): CSSProperties {
  const centerX = size / 2 - size * (1 - STACK_OVERLAP);
  const radius = size / 2 + STACK_GAP_PX;
  const mask = `radial-gradient(circle at ${centerX}px 50%, transparent ${radius - 0.5}px, #000 ${radius}px)`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

interface AvatarCircleProps {
  url: string | undefined;
  size: number;
  style?: CSSProperties;
  onError: () => void;
}

function AvatarCircle({ url, size, style, onError }: AvatarCircleProps) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const loaded = Boolean(url) && url === loadedUrl;

  return (
    <span
      className="relative inline-block shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size, ...style }}
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
          onError={onError}
          className={cn(
            "absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 ease-out",
            loaded && "opacity-100",
          )}
        />
      )}
    </span>
  );
}

export default function ArtistAvatar({
  artistId,
  artistList,
  size,
  className,
}: ArtistAvatarProps) {
  const [firstId, secondId] = avatarArtistIds(artistId, artistList);
  const firstUrl = useAvatarUrl(firstId);
  const secondUrl = useAvatarUrl(secondId);
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const markFailed = (url: string | null | undefined) => () => {
    if (url) setFailed((prev) => new Set(prev).add(url));
  };

  const avatars = [firstUrl, secondUrl].filter(
    (url): url is string | undefined =>
      url !== null && !(url && failed.has(url)),
  );
  if (!firstId || avatars.length === 0) return null;

  return (
    <span aria-hidden className={cn("inline-flex shrink-0", className)}>
      {avatars.map((url, index) => (
        <AvatarCircle
          key={index}
          url={url}
          size={size}
          onError={markFailed(url)}
          style={
            index === 1
              ? {
                  marginLeft: -size * STACK_OVERLAP,
                  ...cutoutMask(size),
                }
              : { zIndex: 1 }
          }
        />
      ))}
    </span>
  );
}
