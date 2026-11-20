const RECENT_KEY = "liner_recent_playlists_v1";
const RECENT_MAX = 5;
const recentListeners = new Set<() => void>();
let cached: string[] | null = null;

function readFromStorage(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(RECENT_KEY) ?? "[]",
    );
    return Array.isArray(parsed)
      ? parsed
          .filter((v): v is string => typeof v === "string")
          .slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

export function readRecentPlaylists(): string[] {
  cached ??= readFromStorage();
  return cached;
}

export function rememberRecentPlaylists(ids: string[]): void {
  if (ids.length === 0) return;
  const next = [...new Set([...ids, ...readRecentPlaylists()])].slice(
    0,
    RECENT_MAX,
  );
  cached = next;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
  recentListeners.forEach((listener) => listener());
}

export function subscribeRecentPlaylists(listener: () => void): () => void {
  recentListeners.add(listener);
  return () => recentListeners.delete(listener);
}

export function resetRecentPlaylistsCache(): void {
  cached = null;
}

export function sortByRecent<T extends { id: string }>(
  playlists: T[],
  recent: string[] = readRecentPlaylists(),
): T[] {
  const rank = new Map(recent.map((id, index) => [id, index]));
  return playlists
    .map((playlist, index) => ({ playlist, index }))
    .sort((a, b) => {
      const ra = rank.get(a.playlist.id) ?? Infinity;
      const rb = rank.get(b.playlist.id) ?? Infinity;
      return ra === rb ? a.index - b.index : ra - rb;
    })
    .map(({ playlist }) => playlist);
}
