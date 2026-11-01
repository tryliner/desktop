import type { ReactNode } from "react";
import { HeartFill } from "@mingcute/react";
import { ToggleSwitch } from "@/shared/ui";
import { PresetPills } from "@/shared/ui/PresetPills";
import { useTranslation } from "@/languages";
import { LocalFilesIcon, useLocalLibraryStore } from "@/features/library/local";
import { useSavedTracksStore } from "@/features/library/saved";
import {
  formatStorageBytes,
  openDownloadsFolder,
  type StorageCategoryItem,
} from "@/shared/utils/cacheManager";
import { SettingRow, SettingSection } from "../controls";
import { StorageSizeAction } from "./StorageSizeAction";
import { StorageFolderButton } from "./StorageFolderButton";
import { useSongEstimate } from "./StorageOverview";

const GB = 1024 * 1024 * 1024;
const LIMIT_OPTIONS = [2, 5, 20, 0];

function RowIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-[36px] w-[36px] items-center justify-center rounded-[8px] bg-black/[0.05] text-text-secondary dark:bg-white/[0.08]">
      {children}
    </span>
  );
}

export function StorageDownloadsSection({
  liked,
  local,
  onRemove,
  songBytes,
  searchQuery,
}: {
  songBytes: number;
  liked?: StorageCategoryItem;
  local?: StorageCategoryItem;
  onRemove: (
    kind: "liked" | "local",
    bytes: number,
    remove: () => Promise<unknown>,
  ) => void;
  searchQuery?: string;
}) {
  const { t } = useTranslation();
  const enabled = useSavedTracksStore((state) => state.enabled);
  const limitBytes = useSavedTracksStore((state) => state.limitBytes);
  const status = useSavedTracksStore((state) => state.status);
  const records = useSavedTracksStore((state) => state.records);
  const setEnabled = useSavedTracksStore((state) => state.setEnabled);
  const setLimitBytes = useSavedTracksStore((state) => state.setLimitBytes);
  const removeSaved = useSavedTracksStore((state) => state.removeAll);
  const removeLocal = useLocalLibraryStore((state) => state.removeAll);

  const limitSongs = useSongEstimate(limitBytes, songBytes);
  const savedCount = records.length;
  const likedBytes =
    records.length > 0
      ? records.reduce((sum, record) => sum + record.byteSize, 0)
      : (liked?.bytes ?? 0);
  const localBytes = local?.bytes ?? 0;
  const localCount = local?.count ?? 0;

  const likedDescription = (() => {
    if (!enabled) return t("settings.storage.liked_status.disabled");
    switch (status.phase) {
      case "saving":
        return t("settings.storage.liked_status.saving", {
          count: status.pending,
        });
      case "starting":
        return t("settings.storage.liked_status.starting");
      case "waiting":
        return t("settings.storage.liked_status.waiting", {
          time: new Date(status.resumeAt ?? Date.now()).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
      case "offline":
        return t("settings.storage.liked_status.offline");
      case "limit":
        return t("settings.storage.liked_status.limit", {
          count: status.pending,
        });
      case "disk":
        return t("settings.storage.liked_status.disk");
      default:
        return t("settings.storage.liked_desc", {
          songs: t("common.songs", { count: savedCount }),
        });
    }
  })();

  return (
    <SettingSection
      label={t("settings.storage.downloads_title")}
      action={
        <StorageFolderButton
          label={t("settings.storage.open_folder_short")}
          onOpen={() => void openDownloadsFolder()}
        />
      }
    >
      <SettingRow
        icon={
          <RowIcon>
            <HeartFill size={17} />
          </RowIcon>
        }
        title={t("settings.storage.categories.liked")}
        description={likedDescription}
        explained
        titleKey="settings.storage.categories.liked"
        searchQuery={searchQuery}
        control={
          <div className="flex items-center gap-[12px]">
            <StorageSizeAction
              bytes={likedBytes}
              actionLabel={t("settings.storage.remove")}
              confirmLabel={t("settings.storage.remove_size", {
                size: formatStorageBytes(likedBytes),
              })}
              disabled={likedBytes === 0 && savedCount === 0}
              onConfirm={() => onRemove("liked", likedBytes, removeSaved)}
            />
            <ToggleSwitch
              checked={enabled}
              onChange={setEnabled}
              ariaLabel={t("settings.storage.liked_toggle")}
            />
          </div>
        }
      />

      <SettingRow
        icon={
          <RowIcon>
            <LocalFilesIcon size={18} />
          </RowIcon>
        }
        title={t("settings.storage.categories.local")}
        description={
          localCount > 0
            ? t("settings.storage.local_desc", {
                songs: t("common.songs", { count: localCount }),
              })
            : t("settings.storage.local_empty")
        }
        explained
        titleKey="settings.storage.categories.local"
        searchQuery={searchQuery}
        control={
          <StorageSizeAction
            bytes={localBytes}
            actionLabel={t("settings.storage.remove")}
            confirmLabel={t("settings.storage.remove_size", {
              size: formatStorageBytes(localBytes),
            })}
            disabled={localCount === 0}
            onConfirm={() => onRemove("local", localBytes, removeLocal)}
          />
        }
      />

      <SettingRow
        title={t("settings.storage.downloads_limit")}
        description={
          limitBytes > 0
            ? t("settings.storage.downloads_limit_hint", {
                count: limitSongs,
              })
            : t("settings.storage.downloads_limit_unlimited")
        }
        explained
        titleKey="settings.storage.downloads_limit"
        searchQuery={searchQuery}
        control={
          <PresetPills
            ariaLabel={t("settings.storage.downloads_limit")}
            size="md"
            fill={false}
            value={limitBytes}
            onChange={setLimitBytes}
            disabled={!enabled}
            options={LIMIT_OPTIONS.map((gb) => ({
              value: gb * GB,
              label: gb === 0 ? t("settings.storage.no_limit") : `${gb} GB`,
            }))}
          />
        }
      />
    </SettingSection>
  );
}
