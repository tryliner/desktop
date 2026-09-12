import { useState } from "react";
import { motion } from "framer-motion";
import { CloseLine } from "@mingcute/react";
import {
  Play,
  Palette,
  HeadphonesRound,
  ShieldCheck,
  InfoCircle,
  Book2,
  QuestionCircle,
  MenuDots,
  Settings,
} from "@solar-icons/react";
import Dialog from "@/shared/ui/Dialog";
import { UserAvatar } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { useModalStore } from "@/features/library";
import { useAuthStore } from "@/features/auth";
import {
  PlaybackTab,
  AppearanceTab,
  AudioTab,
  PrivacyTab,
  AboutTab,
} from "./tabs";

type TabId = "Playback" | "Appearance" | "Audio" | "Privacy" | "About";

const TAB_ICONS: Record<TabId, typeof Play> = {
  Playback: Play,
  Appearance: Palette,
  Audio: HeadphonesRound,
  Privacy: ShieldCheck,
  About: InfoCircle,
};

const TAB_GROUPS: { labelKey: "preferences" | "application"; ids: TabId[] }[] = [
  { labelKey: "preferences", ids: ["Playback", "Audio", "Appearance"] },
  { labelKey: "application", ids: ["Privacy", "About"] },
];

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

export default function SettingsModal() {
  const { t } = useTranslation();
  const open = useModalStore((state) => state.settingsOpen);
  const close = useModalStore((state) => state.closeSettings);

  const [activeTab, setActiveTab] = useState<TabId>("Playback");

  const handleClose = () => {
    close();
  };

  const tabLabels: Record<TabId, string> = {
    Playback: t("settings.tabs.playback"),
    Appearance: t("settings.tabs.appearance"),
    Audio: t("settings.tabs.audio"),
    Privacy: t("settings.tabs.privacy"),
    About: t("settings.tabs.about"),
  };

  const tabDescriptions: Record<TabId, string> = {
    Playback: t("settings.playback.description"),
    Appearance: t("settings.theme.description"),
    Audio: t("settings.audio_data.description"),
    Privacy: t("settings.privacy.description"),
    About: t("common.app.version"),
  };

  const openExternal = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const user = useAuthStore((state) => state.user);
  const displayName =
    user?.displayName ||
    user?.username ||
    user?.email?.split("@")[0] ||
    "Liner";
  const handle = user?.username ? `@${user.username}` : (user?.email ?? t("settings.manage_account"));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? handleClose() : undefined)}
      maxWidth={880}
      className="p-0 h-[620px] max-h-[86vh] !flex-row overflow-hidden !bg-bg-elevated !border-0"
    >
      {/* ── Left sidebar ── */}
      <aside className="w-[248px] shrink-0 flex flex-col min-h-0 bg-transparent">
        <div className="flex items-center gap-[11px] px-[16px] pt-[16px] pb-[12px]">
          <span className="w-[34px] h-[34px] rounded-[10px] bg-border-alpha-14 flex items-center justify-center shrink-0">
            <Settings size={19} weight="Bold" className="text-text-primary" />
          </span>
          <span className="min-w-0 flex flex-col leading-tight">
            <span
              className="text-text-primary text-[14.5px] font-[600] tracking-[-0.01em] truncate"
              style={font}
            >
              {t("settings.title")}
            </span>
            <span
              className="text-text-tertiary text-[12px] truncate"
              style={font}
            >
              {t("settings.subtitle")}
            </span>
          </span>
        </div>

        <nav
          className="flex-1 min-h-0 overflow-y-auto px-[12px] pb-[12px] flex flex-col gap-[14px]"
          role="tablist"
          aria-label={t("settings.title")}
        >
          {TAB_GROUPS.map((group) => (
            <div key={group.labelKey} className="flex flex-col gap-[2px]">
              <p
                className="text-text-tertiary text-[11px] font-[500] m-0 px-[10px] pb-[4px] pt-[2px]"
                style={font}
              >
                {t(`settings.groups.${group.labelKey}`)}
              </p>
              {group.ids.map((id) => {
                const isActive = id === activeTab;
                const Icon = TAB_ICONS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(id)}
                    className={`w-full flex items-center gap-[10px] px-[10px] py-[8px] rounded-[8px] border-0 cursor-pointer text-left transition-colors ${
                      isActive
                        ? "bg-border-alpha-14 text-text-primary"
                        : "bg-transparent text-text-secondary hover:bg-border-alpha-14 hover:text-text-primary"
                    }`}
                    style={{ ...font, fontSize: "13.5px", fontWeight: isActive ? 500 : 400 }}
                  >
                    <Icon
                      size={18}
                      weight="Bold"
                      className={isActive ? "text-text-primary shrink-0" : "text-text-tertiary shrink-0"}
                    />
                    <span className="truncate leading-none">{tabLabels[id]}</span>
                  </button>
                );
              })}
            </div>
          ))}

          <div className="flex flex-col gap-[2px] pt-[2px] mt-[2px] border-t border-solid border-border-primary">
            <p
              className="text-text-tertiary text-[11px] font-[500] m-0 px-[10px] pt-[10px] pb-[4px]"
              style={font}
            >
              {t("settings.groups.help")}
            </p>
            <button
              type="button"
              onClick={() => openExternal("https://tryliner.fun/docs")}
              className="w-full flex items-center gap-[10px] px-[10px] py-[8px] rounded-[8px] border-0 bg-transparent text-text-secondary hover:bg-border-alpha-14 hover:text-text-primary cursor-pointer text-left transition-colors"
              style={{ ...font, fontSize: "13.5px" }}
            >
              <Book2 size={18} weight="Bold" className="text-text-tertiary shrink-0" />
              <span className="leading-none">{t("settings.docs")}</span>
            </button>
            <button
              type="button"
              onClick={() => openExternal("https://t.me/liner_app")}
              className="w-full flex items-center gap-[10px] px-[10px] py-[8px] rounded-[8px] border-0 bg-transparent text-text-secondary hover:bg-border-alpha-14 hover:text-text-primary cursor-pointer text-left transition-colors"
              style={{ ...font, fontSize: "13.5px" }}
            >
              <QuestionCircle size={18} weight="Bold" className="text-text-tertiary shrink-0" />
              <span className="leading-none">{t("settings.support")}</span>
            </button>
          </div>
        </nav>

        {/* profile footer */}
        <div className="shrink-0 p-[12px] pt-[8px]">
          <div className="flex items-center gap-[10px] px-[6px] py-[4px] min-w-0">
            <span className="relative shrink-0">
              <UserAvatar user={user ?? null} size={32} />
              <span className="absolute right-[-1px] bottom-[-1px] w-[10px] h-[10px] rounded-full bg-[#12B76A] border-2 border-bg-primary" aria-hidden />
            </span>
            <span className="flex-1 min-w-0 flex flex-col leading-tight">
              <span
                className="text-text-primary text-[13px] font-[500] truncate"
                style={font}
              >
                {displayName}
              </span>
              <span
                className="text-text-tertiary text-[12px] truncate"
                style={font}
              >
                {handle}
              </span>
            </span>
            <MenuDots size={18} weight="Bold" className="text-text-tertiary shrink-0" />
          </div>
        </div>
      </aside>

      {/* ── Right secondary frame: same roundness, inset with padding, darker ── */}
      <div className="flex-1 min-w-0 min-h-0 p-[2px] flex">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col rounded-xl bg-bg-primary overflow-hidden">
        <div className="flex items-start justify-between gap-[16px] px-[24px] pt-[20px] pb-[10px] shrink-0">
          <div className="min-w-0">
            <h3
              className="text-text-primary text-[15px] m-0 font-[600] tracking-[-0.01em]"
              style={font}
            >
              {tabLabels[activeTab]}
            </h3>
            <p
              className="text-text-tertiary text-[13px] m-0 mt-[3px] leading-snug"
              style={font}
            >
              {tabDescriptions[activeTab]}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("common.close") || "Close"}
            onClick={handleClose}
            className="w-[28px] h-[28px] shrink-0 inline-flex items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-border-alpha-14 transition-colors border-0 bg-transparent p-0 cursor-pointer"
          >
            <CloseLine size={17} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-[24px] pb-[16px]">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.1, ease: "linear" }}
          >
            {activeTab === "Playback" && <PlaybackTab />}
            {activeTab === "Appearance" && <AppearanceTab />}
            {activeTab === "Audio" && <AudioTab />}
            {activeTab === "Privacy" && <PrivacyTab />}
            {activeTab === "About" && <AboutTab />}
          </motion.div>
        </div>
        </div>
      </div>
    </Dialog>
  );
}
