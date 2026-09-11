import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CloseLine, BackLine } from "@mingcute/react";
import { useTheme } from "next-themes";
import Dialog from "@/shared/ui/Dialog";
import Button from "@/shared/ui/Button";
import { useTranslation, type Locale } from "@/languages";
import { useModalStore } from "@/features/library";
import {
  usePlayerStore,
  type AccentVariant,
  type AudioQuality,
  type DefaultPlaybackContext,
  type TrackDoubleClickBehavior,
} from "@/features/player";
import { isTelemetryEnabled, setTelemetryEnabled } from "@/shared/telemetry";
import {
  GeneralTab,
  AppearanceTab,
  AudioTab,
  SystemTab,
  AboutTab,
} from "./tabs";

const TAB_IDS = [
  "General",
  "Appearance",
  "Audio",
  "System",
  "About",
] as const;

type TabId = (typeof TAB_IDS)[number];

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

interface SettingsSnapshot {
  theme?: string;
  locale: Locale;
  accentVariant: AccentVariant;
  autoplaySimilar: boolean;
  trackDoubleClickBehavior: TrackDoubleClickBehavior;
  defaultPlaybackContext: DefaultPlaybackContext;
  audioQuality: AudioQuality;
  pauseOnDeviceChange: boolean;
  telemetry: boolean;
}

export default function SettingsModal() {
  const { t, locale, setLocale } = useTranslation();
  const { theme, setTheme } = useTheme();
  const open = useModalStore((state) => state.settingsOpen);
  const close = useModalStore((state) => state.closeSettings);

  const [activeTab, setActiveTab] = useState<TabId>("General");
  const snapshotRef = useRef<SettingsSnapshot | null>(null);

  // snapshot initial settings on modal open to support cancellation
  useEffect(() => {
    if (open) {
      snapshotRef.current = {
        theme,
        locale,
        accentVariant: usePlayerStore.getState().accentVariant,
        autoplaySimilar: usePlayerStore.getState().autoplaySimilar,
        trackDoubleClickBehavior: usePlayerStore.getState().trackDoubleClickBehavior,
        defaultPlaybackContext: usePlayerStore.getState().defaultPlaybackContext,
        audioQuality: usePlayerStore.getState().audioQuality,
        pauseOnDeviceChange: usePlayerStore.getState().pauseOnDeviceChange,
        telemetry: isTelemetryEnabled(),
      };
    } else {
      snapshotRef.current = null;
    }
  }, [open]);

  const handleCancel = () => {
    if (snapshotRef.current) {
      const snap = snapshotRef.current;
      if (snap.theme) setTheme(snap.theme);
      setLocale(snap.locale);
      const store = usePlayerStore.getState();
      store.setAccentVariant(snap.accentVariant);
      store.setAutoplaySimilar(snap.autoplaySimilar);
      store.setTrackDoubleClickBehavior(snap.trackDoubleClickBehavior);
      store.setDefaultPlaybackContext(snap.defaultPlaybackContext);
      store.setAudioQuality(snap.audioQuality);
      store.setPauseOnDeviceChange(snap.pauseOnDeviceChange);
      setTelemetryEnabled(snap.telemetry);
      snapshotRef.current = null;
    }
    close();
  };

  const handleSave = () => {
    snapshotRef.current = null;
    close();
  };

  const handleResetDefaults = () => {
    setTheme("system");
    setLocale("en");
    const store = usePlayerStore.getState();
    store.setAccentVariant("default");
    store.setAutoplaySimilar(true);
    store.setTrackDoubleClickBehavior("play");
    store.setDefaultPlaybackContext("resume");
    store.setAudioQuality("high");
    store.setPauseOnDeviceChange(true);
    setTelemetryEnabled(true);
  };

  const tabLabels: Record<TabId, string> = {
    General: t("settings.tabs.general"),
    Appearance: t("settings.tabs.appearance"),
    Audio: t("settings.tabs.audio"),
    System: t("settings.tabs.system"),
    About: t("settings.tabs.about"),
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? handleCancel() : undefined)}
      maxWidth={640}
      className="p-0 h-[600px] max-h-[85vh] flex flex-col"
    >
      {/* compact title row, tabs carry the visual anchor below */}
      <div className="flex items-center justify-between px-[20px] pt-[16px] pb-[14px] shrink-0">
        <h2
          className="text-text-primary text-[15px] m-0 font-[600] tracking-[-0.01em]"
          style={font}
        >
          {t("settings.title")}
        </h2>
        <button
          type="button"
          aria-label={t("common.close") || "Close"}
          onClick={handleCancel}
          className="w-[26px] h-[26px] inline-flex items-center justify-center rounded-md text-text-primary hover:bg-bg-elevated transition-colors border-0 bg-transparent p-0 cursor-pointer"
        >
          <CloseLine size={16} />
        </button>
      </div>

      {/* quiet text tabs a la reference mock, active gets a short underline */}
      <div className="px-[20px] pt-[2px] shrink-0">
        <div className="flex items-end gap-[28px] border-b border-border-primary" role="tablist">
          {TAB_IDS.map((id) => {
            const label = tabLabels[id];
            const isActive = id === activeTab;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(id)}
                className={`relative bg-transparent border-0 p-0 pb-[12px] cursor-pointer transition-colors ${
                  isActive
                    ? "text-text-primary"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
                style={{
                  ...font,
                  fontSize: "14.5px",
                  fontWeight: isActive ? 600 : 400,
                  lineHeight: "1",
                  letterSpacing: "0",
                }}
              >
                {label}
                {isActive ? (
                  <motion.span
                    layoutId="settingsModalTabIndicator"
                    transition={{
                      type: "spring",
                      bounce: 0.2,
                      duration: 0.4,
                    }}
                    className="absolute left-0 right-0 -bottom-[1px] h-[1.5px] rounded-full bg-text-primary"
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-[20px] pt-[4px] pb-[12px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {activeTab === "General" && <GeneralTab />}
            {activeTab === "Appearance" && <AppearanceTab />}
            {activeTab === "Audio" && <AudioTab />}
            {activeTab === "System" && <SystemTab />}
            {activeTab === "About" && <AboutTab />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* modal actions footer */}
      <div className="flex items-center justify-between border-t border-border-primary px-[20px] py-[12px] shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleResetDefaults}
          className="text-text-tertiary hover:text-text-primary !px-[8px]"
        >
          <BackLine size={15} />
          {t("settings.reset_defaults") || "Reset to defaults"}
        </Button>
        <div className="flex items-center gap-[8px]">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCancel}
          >
            {t("common.cancel") || "Cancel"}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
          >
            {t("settings.save_preferences") || "Save preferences"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
