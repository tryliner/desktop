import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "next-themes";
import { useTranslation, LOCALE_OPTIONS } from "@/languages";
import { MenuSelect, ToggleSwitch, Slider, Button } from "@/shared/ui";
import { revealThemeChange } from "@/shared/lib";
import { SettingBlock, SettingRow, SettingSection } from "../controls";
import { ThemeCard } from "./ThemeCard";
import { useCustomizationStore } from "../../store/customizationStore";

export function AppearanceTab({ searchQuery }: { searchQuery?: string }) {
  const { t, locale, setLocale } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // Customization Store
  const wallpaperUrl = useCustomizationStore((s) => s.wallpaperUrl);
  const wallpaperBlur = useCustomizationStore((s) => s.wallpaperBlur);
  const wallpaperDim = useCustomizationStore((s) => s.wallpaperDim);
  const glassmorphismEnabled = useCustomizationStore((s) => s.glassmorphismEnabled);
  const sidebarBlock = useCustomizationStore((s) => s.sidebarBlock);
  const contentBlock = useCustomizationStore((s) => s.contentBlock);
  const playerBlock = useCustomizationStore((s) => s.playerBlock);
  const closeToTray = useCustomizationStore((s) => s.closeToTray);

  const setWallpaperUrl = useCustomizationStore((s) => s.setWallpaperUrl);
  const setWallpaperBlur = useCustomizationStore((s) => s.setWallpaperBlur);
  const setWallpaperDim = useCustomizationStore((s) => s.setWallpaperDim);
  const setGlassmorphismEnabled = useCustomizationStore((s) => s.setGlassmorphismEnabled);
  const setSidebarBlock = useCustomizationStore((s) => s.setSidebarBlock);
  const setContentBlock = useCustomizationStore((s) => s.setContentBlock);
  const setPlayerBlock = useCustomizationStore((s) => s.setPlayerBlock);
  const setCloseToTray = useCustomizationStore((s) => s.setCloseToTray);
  const resetCustomization = useCustomizationStore((s) => s.resetCustomization);

  // GPU Acceleration
  const [gpuEnabled, setGpuEnabled] = useState(true);
  const [gpuNeedsRestart, setGpuNeedsRestart] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined" && window.linerElectron?.getGpuAcceleration) {
      window.linerElectron.getGpuAcceleration().then((val) => {
        setGpuEnabled(Boolean(val));
      }).catch(() => {});
    }
  }, []);

  const handleToggleGpu = useCallback(async (next: boolean) => {
    setGpuEnabled(next);
    setGpuNeedsRestart(true);
    if (window.linerElectron?.setGpuAcceleration) {
      await window.linerElectron.setGpuAcceleration(next);
    }
  }, []);

  const handleRelaunch = useCallback(() => {
    window.linerElectron?.relaunch?.();
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        setWallpaperUrl(result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <SettingSection>
      <SettingRow
        title={t("settings.language.label")}
        description={t("settings.language.description")}
        titleKey="settings.language.label"
        descKey="settings.language.description"
        searchQuery={searchQuery}
        control={
          mounted ? (
            <MenuSelect
              options={LOCALE_OPTIONS}
              value={locale}
              onChange={setLocale}
              className="min-w-[130px]"
              aria-label={t("settings.language.label")}
            />
          ) : (
            <span />
          )
        }
      />

      <SettingBlock
        title={t("settings.theme.title")}
        description={t("settings.theme.description")}
        titleKey="settings.theme.title"
        descKey="settings.theme.description"
        searchQuery={searchQuery}
      >
        {mounted ? (
          <div className="grid grid-cols-3 gap-[10px]">
            {(
              [
                { value: "system", label: t("settings.theme.system") },
                { value: "light", label: t("settings.theme.light") },
                { value: "dark", label: t("settings.theme.dark") },
              ] as const
            ).map((item) => {
              return (
                <ThemeCard
                  key={item.value}
                  mode={item.value}
                  label={item.label}
                  active={theme === item.value}
                  onSelect={(event) =>
                    revealThemeChange(() => setTheme(item.value), {
                      x: event.clientX,
                      y: event.clientY,
                    })
                  }
                />
              );
            })}
          </div>
        ) : null}
      </SettingBlock>

      {/* Custom Wallpaper Section */}
      <SettingBlock
        title="Custom Wallpaper"
        description="Choose a custom background image with adjustable blur and dimming."
        searchQuery={searchQuery}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload Wallpaper
            </Button>
            {wallpaperUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWallpaperUrl("")}
                className="text-rose-400 hover:text-rose-300"
              >
                Remove Wallpaper
              </Button>
            )}
          </div>

          {wallpaperUrl && (
            <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.08]">
              <div className="w-full max-w-[320px]">
                <Slider
                  label="Wallpaper Blur"
                  value={wallpaperBlur}
                  onChange={setWallpaperBlur}
                  min={0}
                  max={60}
                  step={1}
                  unit="px"
                />
              </div>
              <div className="w-full max-w-[320px]">
                <Slider
                  label="Wallpaper Dim"
                  value={wallpaperDim}
                  onChange={setWallpaperDim}
                  min={0}
                  max={80}
                  step={1}
                  unit="%"
                />
              </div>
            </div>
          )}
        </div>
      </SettingBlock>

      {/* Block-Level Glassmorphism Section */}
      <SettingBlock
        title="Block-Level Glassmorphism"
        description="Custom translucent acrylic blur across Sidebar, Main Content, and Player bar."
        searchQuery={searchQuery}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-text-secondary">
              Enable Frosted Glass Surfaces
            </span>
            <ToggleSwitch
              checked={glassmorphismEnabled}
              onChange={setGlassmorphismEnabled}
              ariaLabel="Enable Glassmorphism"
            />
          </div>

          {glassmorphismEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-white/[0.08]">
              {/* Sidebar Block */}
              <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-black/[0.06] dark:bg-white/[0.04]">
                <span className="text-[12px] font-semibold text-text-primary">Sidebar</span>
                <Slider
                  label="Opacity"
                  value={sidebarBlock.opacity}
                  onChange={(opacity) => setSidebarBlock({ opacity })}
                  min={10}
                  max={100}
                  unit="%"
                />
                <Slider
                  label="Blur"
                  value={sidebarBlock.blur}
                  onChange={(blur) => setSidebarBlock({ blur })}
                  min={0}
                  max={40}
                  unit="px"
                />
                <Slider
                  label="Dim"
                  value={sidebarBlock.dim}
                  onChange={(dim) => setSidebarBlock({ dim })}
                  min={0}
                  max={60}
                  unit="%"
                />
              </div>

              {/* Main Content Block */}
              <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-black/[0.06] dark:bg-white/[0.04]">
                <span className="text-[12px] font-semibold text-text-primary">Content Area</span>
                <Slider
                  label="Opacity"
                  value={contentBlock.opacity}
                  onChange={(opacity) => setContentBlock({ opacity })}
                  min={10}
                  max={100}
                  unit="%"
                />
                <Slider
                  label="Blur"
                  value={contentBlock.blur}
                  onChange={(blur) => setContentBlock({ blur })}
                  min={0}
                  max={40}
                  unit="px"
                />
                <Slider
                  label="Dim"
                  value={contentBlock.dim}
                  onChange={(dim) => setContentBlock({ dim })}
                  min={0}
                  max={60}
                  unit="%"
                />
              </div>

              {/* Player Block */}
              <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-black/[0.06] dark:bg-white/[0.04]">
                <span className="text-[12px] font-semibold text-text-primary">Player Bar</span>
                <Slider
                  label="Opacity"
                  value={playerBlock.opacity}
                  onChange={(opacity) => setPlayerBlock({ opacity })}
                  min={10}
                  max={100}
                  unit="%"
                />
                <Slider
                  label="Blur"
                  value={playerBlock.blur}
                  onChange={(blur) => setPlayerBlock({ blur })}
                  min={0}
                  max={40}
                  unit="px"
                />
                <Slider
                  label="Dim"
                  value={playerBlock.dim}
                  onChange={(dim) => setPlayerBlock({ dim })}
                  min={0}
                  max={60}
                  unit="%"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetCustomization}
              className="text-[12px] text-text-tertiary hover:text-text-primary"
            >
              Reset Appearance Defaults
            </Button>
          </div>
        </div>
      </SettingBlock>

      {/* GPU Hardware Acceleration */}
      <SettingRow
        title="Hardware Acceleration (GPU)"
        description="Accelerates graphics and animations via your graphics card. Disable if you encounter stuttering or display driver glitches."
        searchQuery={searchQuery}
        control={
          <div className="flex items-center gap-3">
            {gpuNeedsRestart && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRelaunch}
                className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[12px]"
              >
                Relaunch to apply
              </Button>
            )}
            <ToggleSwitch
              checked={gpuEnabled}
              onChange={handleToggleGpu}
              ariaLabel="Toggle Hardware Acceleration"
            />
          </div>
        }
      />

      {/* Close to System Tray */}
      <SettingRow
        title="Close to System Tray"
        description="Minimizes the application to the background system tray instead of exiting when clicking the window close button."
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            checked={closeToTray}
            onChange={setCloseToTray}
            ariaLabel="Toggle Close to System Tray"
          />
        }
      />
    </SettingSection>
  );
}
