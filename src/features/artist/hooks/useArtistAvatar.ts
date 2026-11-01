import { useEffect, useState } from "react";
import { cachedArtistAvatar, loadArtistAvatar } from "../lib/artistAvatar";

interface LoadedAvatar {
  artistId: string;
  url: string | null;
}

export function useArtistAvatar(artistId?: string): string | null | undefined {
  const [loaded, setLoaded] = useState<LoadedAvatar | null>(null);

  useEffect(() => {
    if (!artistId || cachedArtistAvatar(artistId) !== undefined) return;
    let active = true;
    void loadArtistAvatar(artistId).then((url) => {
      if (active) setLoaded({ artistId, url });
    });
    return () => {
      active = false;
    };
  }, [artistId]);

  if (!artistId) return null;
  if (loaded?.artistId === artistId) return loaded.url;
  return cachedArtistAvatar(artistId);
}
