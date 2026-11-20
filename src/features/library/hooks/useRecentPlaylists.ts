import { useSyncExternalStore } from "react";
import {
  readRecentPlaylists,
  subscribeRecentPlaylists,
} from "../services/recentPlaylists";

const EMPTY: string[] = [];

export function useRecentPlaylists(): string[] {
  return useSyncExternalStore(
    subscribeRecentPlaylists,
    readRecentPlaylists,
    () => EMPTY,
  );
}
