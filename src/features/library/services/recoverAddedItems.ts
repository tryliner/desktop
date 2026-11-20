import type { ApiUserPlaylistItem } from "@/shared/api";

export const ADDED_WINDOW_MS = 2 * 60_000;

export function pickAddedItems(
  items: ApiUserPlaylistItem[],
  trackIds: string[],
  since: number,
): ApiUserPlaylistItem[] {
  const wanted = new Set(trackIds);
  return items.filter((item) => {
    if (!wanted.has(item.track.id)) return false;
    const addedAt = Date.parse(item.addedAt);
    return Number.isFinite(addedAt) && addedAt >= since - ADDED_WINDOW_MS;
  });
}

export async function createdItems(
  res: { items: ApiUserPlaylistItem[]; added: number },
  trackIds: string[],
  startedAt: number,
  listItems: () => Promise<ApiUserPlaylistItem[]>,
): Promise<ApiUserPlaylistItem[]> {
  if (res.added === 0 || res.items.length >= res.added) return res.items;
  try {
    return pickAddedItems(await listItems(), trackIds, startedAt);
  } catch {
    return res.items;
  }
}
