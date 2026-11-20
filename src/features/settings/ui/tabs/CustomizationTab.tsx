import { useTranslation } from "@/languages";
import { SettingBlock, SettingRow, SettingSection } from "../controls";
import {
  DEFAULT_APPEARANCE,
  useAppearanceStore,
} from "../../appearance/appearanceStore";
import { canUseWallpapers } from "../../appearance/wallpaperGallery";
import { WallpaperGallery } from "./customization/WallpaperGallery";
import { WallpaperAdjustments } from "./customization/WallpaperAdjustments";
import { useWallpaperAdd } from "./customization/useWallpaperAdd";

const SMALL_BUTTON =
  "cursor-pointer rounded-control border-none bg-fill px-[12px] py-[6px] text-label font-[500] text-text-primary hover:bg-fill-hover";

export function CustomizationTab({ searchQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();
  const available = canUseWallpapers();
  const hasWallpaper = useAppearanceStore((s) => Boolean(s.wallpaperKey));
  const set = useAppearanceStore((s) => s.set);
  const { add, adding } = useWallpaperAdd(available);

  const resetLooks = () => {
    const { wallpaperKey, wallpaperKind } = useAppearanceStore.getState();
    set({ ...DEFAULT_APPEARANCE, wallpaperKey, wallpaperKind });
  };

  if (!available) {
    return (
      <p className="m-0 text-body text-text-secondary">
        {t("customization.desktop_only")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-[20px]" data-own-drop="screen">
      <SettingSection label={t("customization.background_section")}>
        <SettingBlock
          title={t("customization.wallpaper")}
          description={t("customization.wallpaper_desc")}
          titleKey="customization.wallpaper"
          searchQuery={searchQuery}
        >
          <WallpaperGallery adding={adding} onAdd={(file) => void add(file)} />
        </SettingBlock>
        {hasWallpaper && <WallpaperAdjustments searchQuery={searchQuery} />}
        <SettingRow
          title={t("customization.reset")}
          description={t("customization.reset_desc")}
          titleKey="customization.reset"
          searchQuery={searchQuery}
          control={
            <button type="button" onClick={resetLooks} className={SMALL_BUTTON}>
              {t("customization.reset_button")}
            </button>
          }
        />
      </SettingSection>
    </div>
  );
}
