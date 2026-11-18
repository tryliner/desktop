import { useEffect, useRef, useState } from "react";
import { AddLine, CheckLine, CloseLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { Slider, ToggleSwitch, showToast } from "@/shared/ui";
import { cn } from "@/shared/lib";
import { SettingBlock, SettingRow, SettingSection } from "../controls";
import {
  DEFAULT_APPEARANCE,
  useAppearanceStore,
  wallpaperUrl,
} from "../../appearance/appearanceStore";
import { THEME_PRESETS, isHexColor } from "../../appearance/themePresets";
import {
  THEME_FILE_EXTENSION,
  exportThemeFile,
  parseThemeFile,
} from "../../appearance/themeFile";
import {
  WallpaperError,
  addWallpaper,
  canUseWallpapers,
  removeWallpaper,
  useWallpaperGallery,
} from "../../appearance/wallpaperGallery";

const WALLPAPER_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm";
const ACCENT_SWATCHES = [
  "#ff4d4d",
  "#ff9f43",
  "#ffd43b",
  "#4ade80",
  "#22d3ee",
  "#6c8cff",
  "#b47cff",
  "#ff6b9a",
];

const TILE =
  "relative aspect-[16/10] overflow-hidden rounded-[10px] border-none p-0 cursor-pointer transition-[transform,box-shadow] duration-150 hover:scale-[1.02]";
const SMALL_BUTTON =
  "cursor-pointer rounded-control border-none bg-fill px-[12px] py-[6px] text-label font-[500] text-text-primary hover:bg-fill-hover";

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

/**
 * Themes and backgrounds, back after the redesign: colour presets for both
 * light and dark, an accent (fixed or following the song), and a wallpaper
 * gallery with blur, dim, saturation and panel tint. Changes apply live.
 */
export function CustomizationTab({ searchQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();
  const settings = useAppearanceStore();
  const set = useAppearanceStore((s) => s.set);
  const gallery = useWallpaperGallery();
  const wallpapersAvailable = canUseWallpapers();
  const fileInput = useRef<HTMLInputElement>(null);
  const themeInput = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const addRef = useRef<(file: File) => Promise<void>>(async () => {});
  addRef.current = async (file: File) => {
    setAdding(true);
    try {
      const wallpaper = await addWallpaper(file);
      set({ wallpaperKey: wallpaper.key, wallpaperKind: wallpaper.kind });
    } catch (error) {
      const reason = error instanceof WallpaperError ? error.reason : "";
      showToast(
        reason === "too-large"
          ? t("customization.error_size")
          : reason === "unsupported-type"
            ? t("customization.error_type")
            : t("customization.error_add"),
        "error",
      );
    } finally {
      setAdding(false);
    }
  };
  const add = (file: File) => void addRef.current(file);

  // paste a picture anywhere in this tab to use it
  useEffect(() => {
    if (!wallpapersAvailable) return;
    const onPaste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.files ?? [])].find(
        (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
      );
      if (!file) return;
      event.preventDefault();
      void addRef.current(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [wallpapersAvailable]);

  const exportTheme = () => {
    const text = exportThemeFile(settings);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `liner-theme${THEME_FILE_EXTENSION}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importTheme = async (file: File) => {
    const result = parseThemeFile(await file.text());
    if (!result.ok) {
      showToast(t(`customization.import_error.${result.error}`), "error");
      return;
    }
    set(result.settings);
    showToast(t("customization.imported"), "checkmark", {
      description: result.name,
    });
  };

  const hasWallpaper = Boolean(settings.wallpaperKey);
  const customAccent =
    isHexColor(settings.accent) && !ACCENT_SWATCHES.includes(settings.accent);

  return (
    <div className="flex flex-col gap-[20px]" data-own-drop="screen">
      <SettingSection label={t("customization.theme_section")}>
        <SettingBlock
          title={t("customization.preset")}
          description={t("customization.preset_desc")}
          titleKey="customization.preset"
          searchQuery={searchQuery}
        >
          <div className="grid grid-cols-4 gap-[8px]">
            {THEME_PRESETS.map((preset) => {
              const active = settings.preset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set({ preset: preset.id })}
                  className={cn(
                    "flex cursor-pointer flex-col gap-[6px] rounded-[10px] border-none bg-fill p-[6px] text-left transition-colors hover:bg-fill-hover",
                    active && "ring-2 ring-text-primary/70",
                  )}
                >
                  <span
                    className="relative flex h-[38px] items-end gap-[3px] overflow-hidden rounded-[7px] p-[5px]"
                    style={{ background: preset.swatch[0] }}
                  >
                    <span
                      className="h-full flex-1 rounded-[4px]"
                      style={{ background: preset.swatch[1] }}
                    />
                    <span
                      className="h-[10px] w-[10px] rounded-full"
                      style={{ background: preset.swatch[2] }}
                    />
                  </span>
                  <span className="truncate px-[2px] text-caption font-[500] text-text-primary">
                    {t(`customization.presets.${preset.id}`)}
                  </span>
                </button>
              );
            })}
          </div>
        </SettingBlock>

        <SettingBlock
          title={t("customization.accent")}
          description={t("customization.accent_desc")}
          titleKey="customization.accent"
          searchQuery={searchQuery}
        >
          <div className="flex flex-wrap items-center gap-[8px]">
            {(["default", "cover"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                aria-pressed={settings.accent === choice}
                onClick={() => set({ accent: choice })}
                className={cn(
                  "cursor-pointer rounded-full border-none px-[12px] py-[6px] text-caption font-[500]",
                  settings.accent === choice
                    ? "bg-text-primary text-bg-primary"
                    : "bg-fill text-text-primary hover:bg-fill-hover",
                )}
              >
                {t(`customization.accent_${choice}`)}
              </button>
            ))}
            <span className="mx-[2px] h-[18px] w-px bg-border-alpha-14" />
            {ACCENT_SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                aria-label={hex}
                aria-pressed={settings.accent === hex}
                onClick={() => set({ accent: hex as `#${string}` })}
                className="flex h-[24px] w-[24px] cursor-pointer items-center justify-center rounded-full border-none p-0"
                style={{ background: hex }}
              >
                {settings.accent === hex && (
                  <CheckLine size={14} className="text-black/70" />
                )}
              </button>
            ))}
            <label
              className={cn(
                "relative flex h-[24px] w-[24px] cursor-pointer items-center justify-center overflow-hidden rounded-full",
                customAccent && "ring-2 ring-text-primary/70",
              )}
              title={t("customization.accent_custom")}
              style={{
                background: customAccent
                  ? settings.accent
                  : "conic-gradient(#ff4d4d, #ffd43b, #4ade80, #22d3ee, #6c8cff, #ff6b9a, #ff4d4d)",
              }}
            >
              <input
                type="color"
                aria-label={t("customization.accent_custom")}
                value={
                  isHexColor(settings.accent) ? settings.accent : "#ff4d4d"
                }
                onChange={(e) =>
                  set({ accent: e.target.value as `#${string}` })
                }
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
        </SettingBlock>
      </SettingSection>

      {wallpapersAvailable && (
        <SettingSection label={t("customization.background_section")}>
          <SettingBlock
            title={t("customization.wallpaper")}
            description={t("customization.wallpaper_desc")}
            titleKey="customization.wallpaper"
            searchQuery={searchQuery}
          >
            <input
              ref={fileInput}
              type="file"
              accept={WALLPAPER_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) add(file);
              }}
            />
            <div
              className="grid grid-cols-4 gap-[8px]"
              onDragOver={(e) => {
                if ([...e.dataTransfer.items].some((i) => i.kind === "file")) {
                  e.preventDefault();
                  setDragOver(true);
                }
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) add(file);
              }}
            >
              <button
                type="button"
                aria-pressed={!hasWallpaper}
                onClick={() => set({ wallpaperKey: null, wallpaperKind: null })}
                className={cn(
                  TILE,
                  "flex items-center justify-center bg-fill text-caption font-[500] text-text-secondary",
                  !hasWallpaper && "ring-2 ring-text-primary/70",
                )}
              >
                {t("customization.none")}
              </button>
              {gallery.map((item) => {
                const active = settings.wallpaperKey === item.key;
                return (
                  <div key={item.key} className="group relative">
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        set({
                          wallpaperKey: item.key,
                          wallpaperKind: item.kind,
                        })
                      }
                      className={cn(
                        TILE,
                        "w-full bg-bg-elevated",
                        active && "ring-2 ring-text-primary/70",
                      )}
                    >
                      {item.kind === "video" ? (
                        <video
                          src={wallpaperUrl(item.key)}
                          muted
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <img
                          src={wallpaperUrl(item.key)}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={t("customization.remove_wallpaper")}
                      title={t("customization.remove_wallpaper")}
                      onClick={() => {
                        if (active) {
                          set({ wallpaperKey: null, wallpaperKind: null });
                        }
                        void removeWallpaper(item.key);
                      }}
                      className="absolute right-[4px] top-[4px] flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full border-none bg-black/60 p-0 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <CloseLine size={13} />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                disabled={adding}
                onClick={() => fileInput.current?.click()}
                className={cn(
                  TILE,
                  "flex flex-col items-center justify-center gap-[4px] border-[1.5px] border-dashed border-border-alpha-33 bg-transparent text-caption text-text-secondary hover:text-text-primary disabled:opacity-50",
                  dragOver && "border-text-primary text-text-primary",
                )}
              >
                {adding ? (
                  <span className="h-[16px] w-[16px] animate-spin rounded-full border-[2px] border-current border-t-transparent" />
                ) : (
                  <AddLine size={18} />
                )}
                {t("customization.add")}
              </button>
            </div>
            <p className="m-0 text-caption text-text-tertiary">
              {t("customization.add_hint")}
            </p>
          </SettingBlock>

          {hasWallpaper && (
            <>
              <SettingBlock
                title={t("customization.blur")}
                titleKey="customization.blur"
                searchQuery={searchQuery}
              >
                <Slider
                  ariaLabel={t("customization.blur")}
                  value={settings.blur}
                  min={0}
                  max={40}
                  step={1}
                  unit="px"
                  onChange={(blur) => set({ blur })}
                />
              </SettingBlock>
              <SettingBlock
                title={t("customization.dim")}
                titleKey="customization.dim"
                searchQuery={searchQuery}
              >
                <Slider
                  ariaLabel={t("customization.dim")}
                  value={settings.dim}
                  min={0}
                  max={0.85}
                  step={0.01}
                  formatValue={percent}
                  onChange={(dim) => set({ dim })}
                />
              </SettingBlock>
              <SettingBlock
                title={t("customization.saturation")}
                titleKey="customization.saturation"
                searchQuery={searchQuery}
              >
                <Slider
                  ariaLabel={t("customization.saturation")}
                  value={settings.saturation}
                  min={0.5}
                  max={1.6}
                  step={0.01}
                  formatValue={percent}
                  onChange={(saturation) => set({ saturation })}
                />
              </SettingBlock>
              <SettingBlock
                title={t("customization.panels")}
                description={t("customization.panels_desc")}
                titleKey="customization.panels"
                searchQuery={searchQuery}
              >
                <Slider
                  ariaLabel={t("customization.panels")}
                  value={settings.surfaceOpacity}
                  min={0}
                  max={0.9}
                  step={0.01}
                  formatValue={percent}
                  onChange={(surfaceOpacity) => set({ surfaceOpacity })}
                />
              </SettingBlock>
              <SettingRow
                title={t("customization.readable")}
                description={t("customization.readable_desc")}
                titleKey="customization.readable"
                searchQuery={searchQuery}
                control={
                  <ToggleSwitch
                    checked={settings.readable}
                    onChange={(readable) => set({ readable })}
                  />
                }
              />
              <SettingRow
                title={t("customization.album_backdrop")}
                description={t("customization.album_backdrop_desc")}
                titleKey="customization.album_backdrop"
                searchQuery={searchQuery}
                control={
                  <ToggleSwitch
                    checked={settings.albumBackdrop}
                    onChange={(albumBackdrop) => set({ albumBackdrop })}
                  />
                }
              />
            </>
          )}
        </SettingSection>
      )}

      <SettingSection label={t("customization.share_section")}>
        <SettingRow
          title={t("customization.share")}
          description={t("customization.share_desc")}
          titleKey="customization.share"
          searchQuery={searchQuery}
          control={
            <div className="flex items-center gap-[6px]">
              <input
                ref={themeInput}
                type="file"
                accept={`${THEME_FILE_EXTENSION},application/json`}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void importTheme(file);
                }}
              />
              <button
                type="button"
                onClick={() => themeInput.current?.click()}
                className={SMALL_BUTTON}
              >
                {t("customization.import")}
              </button>
              <button
                type="button"
                onClick={exportTheme}
                className={SMALL_BUTTON}
              >
                {t("customization.export")}
              </button>
            </div>
          }
        />
        <SettingRow
          title={t("customization.reset")}
          description={t("customization.reset_desc")}
          titleKey="customization.reset"
          searchQuery={searchQuery}
          control={
            <button
              type="button"
              onClick={() =>
                set({
                  ...DEFAULT_APPEARANCE,
                  // keep the picture; reset only touches the looks
                  wallpaperKey: settings.wallpaperKey,
                  wallpaperKind: settings.wallpaperKind,
                })
              }
              className={SMALL_BUTTON}
            >
              {t("customization.reset_button")}
            </button>
          }
        />
      </SettingSection>
    </div>
  );
}
