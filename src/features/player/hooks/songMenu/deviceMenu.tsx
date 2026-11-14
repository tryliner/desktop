import { LuEraser, LuTrash2 } from "react-icons/lu";
import type { DropdownMenuItem } from "@/shared/ui/DropdownMenu";
import { showToast } from "@/shared/ui";
import type { SongMenuContext, Translate } from "./types";

const CLOUD_ONLY_ITEMS = new Set([
  "start-radio",
  "like-track",
  "unlike-track",
  "add-to-playlist",
  "remove-from-playlist",
  "share",
]);

export function withCacheItem(
  items: DropdownMenuItem[],
  t: Translate,
  onRemoveFromCache: () => void,
): DropdownMenuItem[] {
  const removeFromCacheItem: DropdownMenuItem = {
    id: "remove-from-cache",
    label: t("common.remove_from_cache"),
    icon: <LuEraser size={15} />,
    onClick: onRemoveFromCache,
  };
  const firstDanger = items.findIndex((item) => item.danger);
  if (firstDanger === -1) return [...items, removeFromCacheItem];
  return [
    ...items.slice(0, firstDanger),
    removeFromCacheItem,
    ...items.slice(firstDanger),
  ];
}

export function buildDeviceMenu(
  cloudItems: DropdownMenuItem[],
  ctx: SongMenuContext,
  t: Translate,
): DropdownMenuItem[] {
  const { id, title, playlistId, onRemoveFromPlaylist, onRemoveFromDevice } =
    ctx;
  const deviceItems = cloudItems.filter(
    (item) => !CLOUD_ONLY_ITEMS.has(item.id),
  );
  const addToPlaylist = cloudItems.find(
    (item) => item.id === "add-to-playlist",
  );
  if (addToPlaylist) {
    const afterQueue =
      deviceItems.findIndex((item) => item.id === "add-to-queue") + 1;
    deviceItems.splice(afterQueue, 0, addToPlaylist);
  }
  if (playlistId && id && onRemoveFromPlaylist) {
    deviceItems.push({
      id: "remove-from-playlist",
      label: t("common.remove_from_playlist"),
      icon: <LuTrash2 size={15} />,
      danger: true,
      onClick: async () => {
        try {
          await onRemoveFromPlaylist();
        } catch {
          showToast(t("common.failed_to_remove_track"), "error");
          return;
        }
        showToast(t("common.removed_from_playlist"), "checkmark", {
          description: title || undefined,
        });
      },
    });
  }
  if (!onRemoveFromDevice) return deviceItems;
  return [
    ...deviceItems,
    {
      id: "remove-from-device",
      label: t("library.local.remove"),
      icon: <LuTrash2 size={15} />,
      danger: true,
      onClick: onRemoveFromDevice,
    },
  ];
}
