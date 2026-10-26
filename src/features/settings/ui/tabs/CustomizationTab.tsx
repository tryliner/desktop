import { useState, useRef, useCallback } from "react";
import { TrashBin2 } from "@solar-icons/react";
import { Upload2Line } from "@mingcute/react";

import { useTranslation } from "@/languages";
import { useTheme } from "next-themes";
import { Button, Slider, useToast } from "@/shared/ui";
import { SettingBlock, SettingRow, SettingSection } from "../controls";
import {
  useCustomizationStore,
  MIN_WALLPAPER_BLUR,
} from "../../store/customizationStore";
import { useWallpaperFade } from "../../hooks/useWallpaperTint";
import WallpaperPreview from "./WallpaperPreview";

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

export function CustomizationTab({ searchQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const backgroundImage = useCustomizationStore((s) => s.backgroundImage);
  const backgroundBlur = useCustomizationStore((s) => s.backgroundBlur);
  const backgroundDim = useCustomizationStore((s) => s.backgroundDim);
  const wallpaperFade = useWallpaperFade();

  const setBackgroundImage = useCustomizationStore((s) => s.setBackgroundImage);
  const setBackgroundBlur = useCustomizationStore((s) => s.setBackgroundBlur);
  const setBackgroundDim = useCustomizationStore((s) => s.setBackgroundDim);
  const resetAll = useCustomizationStore((s) => s.resetAll);

  const { resolvedTheme } = useTheme();
  const isDark =
    resolvedTheme
      ? resolvedTheme === "dark"
      : typeof document !== "undefined" &&
        (document.documentElement.getAttribute("data-theme") === "dark" ||
          (!document.documentElement.getAttribute("data-theme") &&
            window.matchMedia?.("(prefers-color-scheme: dark)")?.matches));

  const handleFileChange = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast(t("settings.customization.invalid_file_type") || "Please select an image or GIF file", "error");
        return;
      }
      if (file.size > 30 * 1024 * 1024) {
        toast(t("settings.customization.file_too_large") || "File size must be under 30 MB", "error");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        if (result) {
          setBackgroundImage(result);
          if (!isDark) {
            toast(
              t("settings.customization.dark_theme_only") ||
                "Customization is only available for dark theme",
              "info",
            );
          } else {
            toast(t("settings.customization.applied") || "Wallpaper applied", "success");
          }
        }
      };
      reader.onerror = () => {
        toast(t("settings.customization.read_error") || "Failed to read image file", "error");
      };
      reader.readAsDataURL(file);
    },
    [setBackgroundImage, toast, t, isDark],
  );

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileChange(file);
    }
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileChange(file);
    }
  };

  return (
    <div className="flex flex-col gap-[16px]">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={onFileInputChange}
      />

      <SettingSection>
        <SettingBlock
          title={t("settings.customization.wallpaper_title") || "Window Wallpaper"}
          description={
            t("settings.customization.wallpaper_description") ||
            "Set a custom image or animated GIF as the full window background."
          }
          titleKey="settings.customization.wallpaper_title"
          descKey="settings.customization.wallpaper_description"
          searchQuery={searchQuery}
        >
          <div className="flex flex-col gap-[12px]">
            <WallpaperPreview
              image={backgroundImage}
              blur={backgroundBlur}
              dim={backgroundDim}
              fade={wallpaperFade}
              isDragOver={isDragOver}
              emptyTitle={t("settings.customization.upload_title") || "Select image or animated GIF"}
              emptyHint={t("settings.customization.upload_hint") || "PNG, JPEG, GIF, WebP (up to 30MB)"}
              onPick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={onDrop}
              actions={
                backgroundImage ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="!h-[28px] !px-[10px] !gap-[5px] !text-[12px] bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border-0"
                    >
                      <Upload2Line size={14} />
                      {t("settings.customization.change_button") || "Change"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setBackgroundImage(null);
                        toast(t("settings.customization.removed") || "Wallpaper removed", "info");
                      }}
                      className="!h-[28px] !w-[28px] !p-0 bg-black/60 hover:bg-[#ff4d4d]/80 text-white backdrop-blur-md border-0"
                      title={t("settings.customization.remove_button") || "Remove"}
                      aria-label={t("settings.customization.remove_button") || "Remove"}
                    >
                      <TrashBin2 size={15} />
                    </Button>
                  </>
                ) : undefined
              }
            />

            {backgroundImage && (
              <div className="grid grid-cols-2 gap-[16px] pt-[4px]">
                <div className="flex flex-col gap-[4px]">
                  <span className="text-text-secondary text-[12px]" style={font}>
                    {t("settings.customization.wallpaper_blur") || "Wallpaper blur"}
                  </span>
                  <Slider
                    value={backgroundBlur}
                    onChange={setBackgroundBlur}
                    min={MIN_WALLPAPER_BLUR}
                    max={30}
                    unit="px"
                    ariaLabel={t("settings.customization.wallpaper_blur") || "Wallpaper blur"}
                  />
                </div>
                <div className="flex flex-col gap-[4px]">
                  <span className="text-text-secondary text-[12px]" style={font}>
                    {t("settings.customization.wallpaper_dim") || "Wallpaper dimming"}
                  </span>
                  <Slider
                    value={backgroundDim}
                    onChange={setBackgroundDim}
                    min={0}
                    max={80}
                    unit="%"
                    ariaLabel={t("settings.customization.wallpaper_dim") || "Wallpaper dimming"}
                  />
                </div>
              </div>
            )}
          </div>
        </SettingBlock>
      </SettingSection>

      <SettingSection>
        <SettingRow
          title={t("settings.customization.reset_all") || "Reset All Customization"}
          description={
            t("settings.customization.reset_all_desc") ||
            "Restore default appearance, clear background image and block glass effects."
          }
          titleKey="settings.customization.reset_all"
          descKey="settings.customization.reset_all_desc"
          searchQuery={searchQuery}
          control={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                resetAll();
                toast(t("settings.customization.all_reset") || "Customization reset", "info");
              }}
            >
              {t("settings.reset_defaults") || "Reset"}
            </Button>
          }
        />
      </SettingSection>
    </div>
  );
}
