import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  CloseLine,
  Search2Line,
  CloseCircleFill,
  ExitLine,
  DiscordFill,
  KeyboardLine,
  YoutubeFill,
  VolumeLine,
} from "@mingcute/react";
import {
  Play,
  Palette,
  InfoCircle,
  Book2,
  QuestionCircle,
  Database,
  Widget5,
  Gallery,
} from "@solar-icons/react";
import Dialog from "@/shared/ui/Dialog";
import { UserAvatar } from "@/shared/ui";
import { useScrollFade } from "@/shared/hooks";
import { useTranslation, getTranslationsForAllLocales } from "@/languages";
import { useModalStore } from "@/features/library";
import { useAuthStore } from "@/features/auth";
import { userDisplayName } from "@/entities/user";
import {
  PlaybackTab,
  AudioTab,
  ShortcutsTab,
  AppearanceTab,
  CustomizationTab,
  StorageTab,
  AboutTab,
  OverlayTab,
  DiscordTab,
  YoutubeTab,
} from "./tabs";

type TabId =
  | "Playback"
  | "Audio"
  | "Shortcuts"
  | "Overlay"
  | "Discord"
  | "Youtube"
  | "Appearance"
  | "Customization"
  | "Storage"
  | "About";

const navGroupClass =
  "flex flex-col gap-[1px] rounded-[14px] bg-bg-surface/70 p-[4px] dark:bg-white/[0.06]";

const TAB_ICONS: Record<TabId, React.ComponentType<any>> = {
  Playback: Play,
  Audio: VolumeLine,
  Shortcuts: KeyboardLine,
  Overlay: Widget5,
  Discord: DiscordFill,
  Youtube: YoutubeFill,
  Appearance: Palette,
  Customization: Gallery,
  Storage: Database,
  About: InfoCircle,
};

type TabGroupKey = "player" | "interface" | "integrations" | "application";

const TAB_GROUPS: { labelKey: TabGroupKey; ids: TabId[] }[] = [
  { labelKey: "player", ids: ["Playback", "Audio", "Shortcuts"] },
  { labelKey: "interface", ids: ["Appearance", "Customization", "Overlay"] },
  { labelKey: "integrations", ids: ["Youtube", "Discord"] },
  { labelKey: "application", ids: ["Storage", "About"] },
];

const SETTING_ITEMS: { tabId: TabId; titleKey: string; descKey?: string }[] = [
  // Playback
  {
    tabId: "Playback",
    titleKey: "settings.autoplay_similar.title",
    descKey: "settings.autoplay_similar.description",
  },
  {
    tabId: "Playback",
    titleKey: "settings.track_double_click.title",
    descKey: "settings.track_double_click.description",
  },
  {
    tabId: "Playback",
    titleKey: "settings.default_playback_context.title",
    descKey: "settings.default_playback_context.description",
  },
  {
    tabId: "Playback",
    titleKey: "settings.audio.pause_on_device_change.title",
    descKey: "settings.audio.pause_on_device_change.description",
  },

  ...[
    "enhancer.title",
    "enhancer.description",
    "enhancer.engine_label",
    "enhancer.engine_description",
    "enhancer.engines.hqmusic_3",
    "enhancer.engines.glyphs_7b",
    "enhancer.engines.fyro_1_1",
    "enhancer.presets.title",
    "enhancer.presets.description",
    "enhancer.presets.studio",
    "enhancer.presets.vinyl",
    "enhancer.presets.concert",
    "vocal_clarity.title",
    "vocal_clarity.description",
    "high_end_air.title",
    "high_end_air.description",
    "bass_depth.title",
    "bass_depth.description",
    "equalizer.title",
    "equalizer.description",
    "equalizer.bands_title",
    "equalizer.bands_description",
    "equalizer.flat",
    "reset.title",
    "reset.description",
  ].map((item) => ({
    tabId: "Audio" as const,
    titleKey: `settings.audio.${item}`,
  })),

  // Shortcuts
  {
    tabId: "Shortcuts",
    titleKey: "settings.shortcuts.global_section",
    descKey: "settings.shortcuts.global_desc",
  },
  {
    tabId: "Shortcuts",
    titleKey: "settings.shortcuts.main_app_section",
    descKey: "settings.shortcuts.main_app_desc",
  },
  {
    tabId: "Shortcuts",
    titleKey: "settings.shortcuts.miniplayer_section",
    descKey: "settings.shortcuts.miniplayer_desc",
  },
  {
    tabId: "Shortcuts",
    titleKey: "settings.shortcuts.toggle_overlay",
    descKey: "settings.shortcuts.toggle_overlay_desc",
  },
  {
    tabId: "Shortcuts",
    titleKey: "settings.shortcuts.quick_like_song",
    descKey: "settings.shortcuts.quick_like_song_desc",
  },
  {
    tabId: "Shortcuts",
    titleKey: "settings.shortcuts.play_pause",
    descKey: "settings.shortcuts.play_pause_desc",
  },
  {
    tabId: "Shortcuts",
    titleKey: "settings.shortcuts.next_track",
    descKey: "settings.shortcuts.next_track_desc",
  },
  {
    tabId: "Shortcuts",
    titleKey: "settings.shortcuts.prev_track",
    descKey: "settings.shortcuts.prev_track_desc",
  },
  {
    tabId: "Shortcuts",
    titleKey: "settings.shortcuts.like_track",
    descKey: "settings.shortcuts.like_track_desc",
  },

  // Overlay
  {
    tabId: "Overlay",
    titleKey: "settings.overlay.position.title",
    descKey: "settings.overlay.position.description",
  },
  {
    tabId: "Overlay",
    titleKey: "settings.overlay.show_lyrics.title",
    descKey: "settings.overlay.show_lyrics.description",
  },
  {
    tabId: "Overlay",
    titleKey: "settings.overlay.auto_show_on_minimize.title",
    descKey: "settings.overlay.auto_show_on_minimize.description",
  },
  {
    tabId: "Overlay",
    titleKey: "settings.overlay.always_on_top.title",
    descKey: "settings.overlay.always_on_top.description",
  },

  // Discord
  {
    tabId: "Discord",
    titleKey: "settings.discord.enable.title",
    descKey: "settings.discord.enable.description",
  },
  {
    tabId: "Discord",
    titleKey: "settings.discord.show_timeline.title",
    descKey: "settings.discord.show_timeline.description",
  },
  {
    tabId: "Discord",
    titleKey: "settings.discord.show_artwork.title",
    descKey: "settings.discord.show_artwork.description",
  },
  {
    tabId: "Discord",
    titleKey: "settings.discord.show_artist_image.title",
    descKey: "settings.discord.show_artist_image.description",
  },
  {
    tabId: "Discord",
    titleKey: "settings.discord.show_paused.title",
    descKey: "settings.discord.show_paused.description",
  },
  {
    tabId: "Discord",
    titleKey: "settings.discord.show_button.title",
    descKey: "settings.discord.show_button.description",
  },
  {
    tabId: "Discord",
    titleKey: "settings.discord.show_download_button.title",
    descKey: "settings.discord.show_download_button.description",
  },
  {
    tabId: "Youtube",
    titleKey: "settings.youtube.account_playback.title",
    descKey: "settings.youtube.account_playback.description",
  },
  {
    tabId: "Youtube",
    titleKey: "settings.youtube.prompt_sign_in.title",
    descKey: "settings.youtube.prompt_sign_in.description",
  },
  {
    tabId: "Youtube",
    titleKey: "settings.youtube.sync_library.title",
    descKey: "settings.youtube.sync_library.description",
  },

  // Appearance
  {
    tabId: "Appearance",
    titleKey: "settings.language.label",
    descKey: "settings.language.description",
  },
  {
    tabId: "Appearance",
    titleKey: "settings.theme.title",
    descKey: "settings.theme.description",
  },
  {
    tabId: "Appearance",
    titleKey: "settings.cover_glow.title",
    descKey: "settings.cover_glow.description",
  },
  {
    tabId: "Customization",
    titleKey: "settings.customization.wallpaper_title",
    descKey: "settings.customization.wallpaper_description",
  },
  {
    tabId: "Customization",
    titleKey: "settings.customization.blocks_title",
    descKey: "settings.customization.blocks_description",
  },
  {
    tabId: "Customization",
    titleKey: "settings.customization.reset_all",
    descKey: "settings.customization.reset_all_desc",
  },

  // Storage
  {
    tabId: "Storage",
    titleKey: "settings.storage.title",
    descKey: "settings.storage.description",
  },
  { tabId: "Storage", titleKey: "settings.storage.usage_title" },
  {
    tabId: "Storage",
    titleKey: "settings.storage.open_folder",
    descKey: "settings.storage.open_folder_description",
  },

  // About
  {
    tabId: "About",
    titleKey: "settings.about.liner",
    descKey: "common.app.version",
  },
  { tabId: "About", titleKey: "settings.notifications.test_button" },
];

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

export default function SettingsModal() {
  const { t } = useTranslation();
  const open = useModalStore((state) => state.settingsOpen);
  const close = useModalStore((state) => state.closeSettings);

  const [activeTab, setActiveTab] = useState<TabId>("Playback");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const {
    attach: attachNavFade,
    onScroll: onNavScroll,
    style: navFadeStyle,
  } = useScrollFade<HTMLElement>();
  const searchCentered = !searchQuery && !searchFocused;

  const handleClose = () => {
    setSearchQuery("");
    close();
  };

  const tabLabels: Record<TabId, string> = {
    Playback: t("settings.tabs.playback"),
    Audio: t("settings.tabs.audio"),
    Shortcuts: t("settings.tabs.shortcuts") || "Shortcuts",
    Overlay: t("settings.tabs.overlay") || "Overlay",
    Discord: t("settings.tabs.discord") || "Discord RPC",
    Youtube: t("settings.tabs.youtube") || "YouTube",
    Appearance: t("settings.tabs.appearance"),
    Customization: t("settings.tabs.customization") || "Customization",
    Storage: t("settings.tabs.storage"),
    About: t("settings.tabs.about"),
  };

  const tabDescriptions: Record<TabId, string> = {
    Playback: t("settings.playback.description"),
    Audio: t("settings.audio.description"),
    Shortcuts:
      t("settings.shortcuts.description") ||
      "System-wide and player keyboard shortcuts.",
    Overlay:
      t("settings.overlay.description") ||
      "Desktop overlay behavior, position and lyrics display.",
    Discord:
      t("settings.discord.description") ||
      "Show what you're listening to on Discord with artwork, artist badge and progress bar.",
    Youtube:
      t("settings.youtube.description") ||
      "Sign in to your YouTube account to prevent playback errors.",
    Appearance: t("settings.theme.description"),
    Customization:
      t("settings.customization.description") ||
      "Window background wallpaper, transparency and block blur effects.",
    Storage: t("settings.storage.description"),
    About: t("settings.about.tagline"),
  };

  const matchingTabIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase().trim();
    const set = new Set<TabId>();

    const TAB_LABEL_KEYS: Record<TabId, string> = {
      Playback: "settings.tabs.playback",
      Audio: "settings.tabs.audio",
      Shortcuts: "settings.tabs.shortcuts",
      Overlay: "settings.tabs.overlay",
      Discord: "settings.tabs.discord",
      Youtube: "settings.tabs.youtube",
      Appearance: "settings.theme.title",
      Customization: "settings.tabs.customization",
      Storage: "settings.tabs.storage",
      About: "settings.tabs.about",
    };

    const TAB_DESC_KEYS: Record<TabId, string> = {
      Playback: "settings.playback.description",
      Audio: "settings.audio.description",
      Shortcuts: "settings.shortcuts.description",
      Overlay: "settings.overlay.description",
      Discord: "settings.discord.description",
      Youtube: "settings.youtube.description",
      Appearance: "settings.theme.description",
      Customization: "settings.customization.description",
      Storage: "settings.storage.description",
      About: "settings.about.tagline",
    };

    (Object.keys(TAB_LABEL_KEYS) as TabId[]).forEach((tabId) => {
      const texts = [
        ...getTranslationsForAllLocales(TAB_LABEL_KEYS[tabId]),
        ...getTranslationsForAllLocales(TAB_DESC_KEYS[tabId]),
      ];
      if (texts.some((txt) => txt.toLowerCase().includes(query))) {
        set.add(tabId);
      }
    });

    SETTING_ITEMS.forEach((item) => {
      const texts = [
        ...getTranslationsForAllLocales(item.titleKey),
        ...(item.descKey ? getTranslationsForAllLocales(item.descKey) : []),
      ];
      if (texts.some((txt) => txt.toLowerCase().includes(query))) {
        set.add(item.tabId);
      }
    });

    return set;
  }, [searchQuery]);

  const filteredGroups = useMemo(() => {
    if (!matchingTabIds) return TAB_GROUPS;

    return TAB_GROUPS.map((group) => {
      const ids = group.ids.filter((id) => matchingTabIds.has(id));
      return { ...group, ids };
    }).filter((group) => group.ids.length > 0);
  }, [matchingTabIds]);

  useEffect(() => {
    if (!searchQuery.trim()) return;
    if (
      matchingTabIds &&
      matchingTabIds.size > 0 &&
      !matchingTabIds.has(activeTab)
    ) {
      const firstMatch = TAB_GROUPS.flatMap((g) => g.ids).find((id) =>
        matchingTabIds.has(id),
      );
      if (firstMatch) {
        setActiveTab(firstMatch);
      }
    }
  }, [searchQuery, matchingTabIds, activeTab]);

  const openExternal = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const displayName = userDisplayName(user) ?? "Liner";
  const handle = user?.username
    ? `@${user.username}`
    : (user?.email ?? t("settings.manage_account"));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? handleClose() : undefined)}
      maxWidth={900}
      className="p-0 h-[700px] !max-h-[90vh] !flex-row overflow-hidden !bg-bg-surface/70 dark:!bg-bg-elevated/50 !backdrop-blur-[60px] !border-0"
    >
      <aside className="w-[248px] shrink-0 flex flex-col min-h-0 bg-transparent">
        <div className="px-[12px] pt-[14px] pb-[8px]">
          <div className="relative flex items-center">
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-y-0 flex items-center gap-[6px] text-text-tertiary text-[13px] transition-all duration-200 ${
                searchCentered ? "left-1/2 -translate-x-1/2" : "left-[10px]"
              }`}
              style={font}
            >
              <Search2Line size={15} className="shrink-0" />
              {!searchQuery && (
                <span className="whitespace-nowrap">
                  {t("settings.search_placeholder")}
                </span>
              )}
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              aria-label={t("settings.search_placeholder")}
              className="w-full h-[34px] pl-[28px] pr-[26px] bg-bg-surface/70 dark:bg-white/[0.08] text-text-primary text-[13px] rounded-[10px] border-0 outline-none placeholder:text-text-tertiary focus:bg-bg-surface dark:focus:bg-white/[0.12] transition-colors"
              style={font}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-[6px] p-0 border-0 bg-transparent text-text-tertiary hover:text-text-primary cursor-pointer flex items-center justify-center"
              >
                <CloseCircleFill size={14} />
              </button>
            )}
          </div>
        </div>

        <nav
          ref={attachNavFade}
          onScroll={onNavScroll}
          style={navFadeStyle}
          className="flex-1 min-h-0 overflow-y-auto px-[12px] pb-[12px] flex flex-col gap-[10px]"
          role="tablist"
          aria-label={t("settings.title")}
        >
          {filteredGroups.length === 0 ? (
            <p
              className="text-text-tertiary text-[12px] px-[10px] py-[8px] m-0"
              style={font}
            >
              {t("search.no_results") || "Ничего не найдено"}
            </p>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.labelKey} className="flex flex-col">
                <p
                  className="text-text-tertiary text-[11px] font-[500] m-0 px-[10px] pb-[4px] pt-[2px]"
                  style={font}
                >
                  {t(`settings.groups.${group.labelKey}`)}
                </p>
                <div className={navGroupClass}>
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
                        className={`w-full flex items-center gap-[10px] px-[10px] py-[7px] rounded-[10px] border-0 cursor-pointer text-left transition-colors ${
                          isActive
                            ? "bg-transparent text-text-primary"
                            : "bg-transparent text-text-secondary hover:bg-black/[0.04] hover:text-text-primary dark:hover:bg-white/[0.05]"
                        }`}
                        style={{
                          ...font,
                          fontSize: "13px",
                          fontWeight: isActive ? 600 : 400,
                        }}
                      >
                        <Icon
                          size={18}
                          weight="Bold"
                          className={
                            isActive
                              ? "text-text-primary shrink-0"
                              : "text-text-tertiary shrink-0"
                          }
                        />
                        <span className="truncate leading-none">
                          {tabLabels[id]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          <div className="flex flex-col">
            <p
              className="text-text-tertiary text-[11px] font-[500] m-0 px-[10px] pb-[4px] pt-[2px]"
              style={font}
            >
              {t("settings.groups.help")}
            </p>
            <div className={navGroupClass}>
              <button
                type="button"
                onClick={() =>
                  openExternal(
                    "https://github.com/tryliner/desktop/blob/main/README.md",
                  )
                }
                className="w-full flex items-center gap-[10px] px-[10px] py-[7px] rounded-[10px] border-0 bg-transparent text-text-secondary hover:bg-black/[0.04] dark:hover:bg-white/[0.05] hover:text-text-primary cursor-pointer text-left transition-colors"
                style={{ ...font, fontSize: "13px" }}
              >
                <Book2
                  size={18}
                  weight="Bold"
                  className="text-text-tertiary shrink-0"
                />
                <span className="leading-none">{t("settings.docs")}</span>
              </button>
              <button
                type="button"
                onClick={() => openExternal("https://t.me/liner_app?direct")}
                className="w-full flex items-center gap-[10px] px-[10px] py-[7px] rounded-[10px] border-0 bg-transparent text-text-secondary hover:bg-black/[0.04] dark:hover:bg-white/[0.05] hover:text-text-primary cursor-pointer text-left transition-colors"
                style={{ ...font, fontSize: "13px" }}
              >
                <QuestionCircle
                  size={18}
                  weight="Bold"
                  className="text-text-tertiary shrink-0"
                />
                <span className="leading-none">{t("settings.support")}</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="shrink-0 p-[12px] pt-[8px]">
          <div className="flex items-center gap-[10px] px-[6px] py-[4px] min-w-0">
            <span className="relative shrink-0">
              <UserAvatar user={user ?? null} size={32} />
              <span
                className="absolute right-[-1px] bottom-[-1px] w-[10px] h-[10px] rounded-full bg-[#12B76A] border-2 border-bg-primary"
                aria-hidden
              />
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
            <button
              type="button"
              onClick={async () => {
                handleClose();
                await logout();
              }}
              title={t("settings.profile.sign_out") || "Log out"}
              aria-label={t("settings.profile.sign_out") || "Log out"}
              className="p-1.5 rounded-md text-text-tertiary hover:text-[#E81123] hover:bg-border-alpha-14 transition-colors border-0 bg-transparent cursor-pointer flex items-center justify-center shrink-0"
            >
              <ExitLine size={18} className="shrink-0" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Right secondary frame: same roundness, inset with padding, darker ── */}
      <div className="flex-1 min-w-0 min-h-0 flex">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col rounded-[20px] bg-bg-primary/40 overflow-hidden">
          <div className="flex items-start justify-between gap-[16px] px-[24px] pt-[24px] pb-[16px] shrink-0">
            <div className="min-w-0">
              <h3 className="font-montserrat text-text-primary text-[20px] m-0 font-[700] tracking-[-0.01em]">
                {tabLabels[activeTab]}
              </h3>
              <p
                className="text-text-secondary text-[12.5px] m-0 mt-[4px] leading-snug"
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

          <div className="flex-1 min-h-0 overflow-y-auto px-[24px] pb-[16px] flex flex-col">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className="flex-1 flex flex-col"
            >
              {activeTab === "Playback" && (
                <PlaybackTab searchQuery={searchQuery} />
              )}
              {activeTab === "Audio" && <AudioTab searchQuery={searchQuery} />}
              {activeTab === "Shortcuts" && (
                <ShortcutsTab searchQuery={searchQuery} />
              )}
              {activeTab === "Overlay" && (
                <OverlayTab searchQuery={searchQuery} />
              )}
              {activeTab === "Discord" && (
                <DiscordTab searchQuery={searchQuery} />
              )}
              {activeTab === "Youtube" && (
                <YoutubeTab searchQuery={searchQuery} />
              )}
              {activeTab === "Appearance" && (
                <AppearanceTab searchQuery={searchQuery} />
              )}
              {activeTab === "Customization" && (
                <CustomizationTab searchQuery={searchQuery} />
              )}
              {activeTab === "Storage" && (
                <StorageTab searchQuery={searchQuery} />
              )}
              {activeTab === "About" && <AboutTab searchQuery={searchQuery} />}
            </motion.div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
