import { useMemo, useSyncExternalStore } from "react";
import {
  readRecentPlaylists,
  subscribeRecentPlaylists,
} from "../services/addToPlaylists";

/** ids of the playlists the user added to most recently, newest first */
export function useRecentPlaylists(): string[] {
  const raw = useSyncExternalStore(
    subscribeRecentPlaylists,
    () => JSON.stringify(readRecentPlaylists()),
    () => "[]",
  );
  return useMemo(() => JSON.parse(raw) as string[], [raw]);
}
