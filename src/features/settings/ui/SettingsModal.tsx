import { useState } from "react";
import { motion } from "framer-motion";
import { CloseLine } from "@mingcute/react";
import Dialog from "@/shared/ui/Dialog";
import { useTranslation } from "@/languages";
import { useModalStore } from "@/features/library";
import {
  GeneralTab,
  AppearanceTab,
  AudioTab,
  AboutTab,
} from "./tabs";

const TAB_IDS = [
  "General",
  "Appearance",
  "Audio",
  "About",
] as const;

type TabId = (typeof TAB_IDS)[number];

export default function SettingsModal() {
  const { t } = useTranslation();
  const open = useModalStore((state) => state.settingsOpen);
  const close = useModalStore((state) => state.closeSettings);

  const [activeTab, setActiveTab] = useState<TabId>("General");

  const tabLabels: Record<TabId, string> = {
    General: t("settings.tabs.general"),
    Appearance: t("settings.tabs.appearance"),
    Audio: t("settings.tabs.audio"),
    About: t("settings.tabs.about"),
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? close() : undefined)}
      maxWidth={760}
      className="p-0 h-[600px] max-h-[85vh] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-[20px] border-b border-border-primary shrink-0">
        <h2
          className="text-text-primary text-[19px] m-0 font-[500]"
          style={{
            fontFamily: "var(--font-inter), sans-serif",
            lineHeight: "1",
            letterSpacing: "-0.01em",
          }}
        >
          {t("settings.title")}
        </h2>
        <button
          type="button"
          aria-label={t("common.close") || "Close"}
          onClick={() => close()}
          className="w-[20px] h-[20px] inline-flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors border-0 bg-transparent p-0 cursor-pointer"
        >
          <CloseLine size={20} />
        </button>
      </div>

      {/* Tabs bar */}
      <div className="border-b border-border-primary px-[20px] pt-[12px] shrink-0">
        <div className="flex items-end gap-[32px]">
          {TAB_IDS.map((id) => {
            const label = tabLabels[id];
            const isActive = id === activeTab;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`relative bg-transparent border-0 p-0 pb-[11px] cursor-pointer transition-colors ${
                  isActive
                    ? "text-text-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
                style={{
                  fontFamily: "var(--font-inter), sans-serif",
                  fontSize: "14.5px",
                  fontWeight: isActive ? 500 : 400,
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
                    className="absolute left-0 right-0 -bottom-[1px] h-[2px] bg-text-primary"
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-[20px] py-[22px]">
        {activeTab === "General" && <GeneralTab />}
        {activeTab === "Appearance" && <AppearanceTab />}
        {activeTab === "Audio" && <AudioTab />}
        {activeTab === "About" && <AboutTab />}
      </div>
    </Dialog>
  );
}
