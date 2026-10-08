import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  SkipNext,
  SkipPrevious,
  VolumeLoud,
  VolumeSmall,
  VolumeCross,
  MusicNote,
  Widget5,
  MaximizeSquare,
} from "@solar-icons/react";
import {
  Search2Line,
  CloseLine,
  HeartFill,
  HeartLine,
  PlaylistFill,
  FastForwardLine,
  FastRewindLine,
  ExternalLinkLine,
} from "@mingcute/react";
import { Refresh } from "@solar-icons/react";
import { useTranslation } from "@/languages";
import Button from "@/shared/ui/Button";
import {
  useShortcutsStore,
  normalizeShortcutToEnglish,
  DEFAULT_SHORTCUTS,
  type GlobalShortcutsSettings,
  type MainAppShortcutsSettings,
  type MiniplayerShortcutsSettings,
} from "@/features/shortcuts";
import { ShortcutRecorder } from "@/features/shortcuts/ui/ShortcutRecorder";

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

type ScopeFilter = "mainApp" | "miniplayer" | "global";

export function ShortcutsTab({ searchQuery: externalQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();
  const [activeScope, setActiveScope] = useState<ScopeFilter>("mainApp");
  const [localSearchQuery, setLocalSearchQuery] = useState("");

  const global = useShortcutsStore((state) => state.global);
  const mainApp = useShortcutsStore((state) => state.mainApp);
  const miniplayer = useShortcutsStore((state) => state.miniplayer);

  const setGlobalShortcut = useShortcutsStore((state) => state.setGlobalShortcut);
  const setMainAppShortcut = useShortcutsStore((state) => state.setMainAppShortcut);
  const setMiniplayerShortcut = useShortcutsStore((state) => state.setMiniplayerShortcut);
  const resetShortcut = useShortcutsStore((state) => state.resetShortcut);
  const resetAll = useShortcutsStore((state) => state.resetAll);

  // Labels for Global Actions
  const globalLabels: Record<keyof GlobalShortcutsSettings, { title: string; desc: string }> = {
    toggleOverlay: {
      title: t("settings.shortcuts.toggle_overlay") || "Toggle miniplayer overlay",
      desc: t("settings.shortcuts.toggle_overlay_desc") || "Show or hide the floating desktop overlay from anywhere in the OS.",
    },
    quickLikeSong: {
      title: t("settings.shortcuts.quick_like_song") || "Quick like current song",
      desc: t("settings.shortcuts.quick_like_song_desc") || "Like or unlike current playing track system-wide without focusing the player.",
    },
  };

  // Labels for Main App Actions
  const mainAppLabels: Record<keyof MainAppShortcutsSettings, { title: string; desc: string }> = {
    playPause: {
      title: t("settings.shortcuts.play_pause") || "Play / Pause",
      desc: t("settings.shortcuts.play_pause_desc") || "Toggle audio playback.",
    },
    nextTrack: {
      title: t("settings.shortcuts.next_track") || "Next track",
      desc: t("settings.shortcuts.next_track_desc") || "Skip to the next song in the queue.",
    },
    prevTrack: {
      title: t("settings.shortcuts.prev_track") || "Previous track",
      desc: t("settings.shortcuts.prev_track_desc") || "Return to previous track or track start.",
    },
    seekForward: {
      title: t("settings.shortcuts.seek_forward") || "Seek forward (+5s)",
      desc: t("settings.shortcuts.seek_forward_desc") || "Fast forward playback position by 5 seconds.",
    },
    seekBackward: {
      title: t("settings.shortcuts.seek_backward") || "Seek backward (-5s)",
      desc: t("settings.shortcuts.seek_backward_desc") || "Rewind playback position by 5 seconds.",
    },
    volumeUp: {
      title: t("settings.shortcuts.volume_up") || "Volume up",
      desc: t("settings.shortcuts.volume_up_desc") || "Increase playback volume by 5%.",
    },
    volumeDown: {
      title: t("settings.shortcuts.volume_down") || "Volume down",
      desc: t("settings.shortcuts.volume_down_desc") || "Decrease playback volume by 5%.",
    },
    toggleMute: {
      title: t("settings.shortcuts.toggle_mute") || "Mute / Unmute",
      desc: t("settings.shortcuts.toggle_mute_desc") || "Toggle audio mute state.",
    },
    search: {
      title: t("settings.shortcuts.search") || "Search music",
      desc: t("settings.shortcuts.search_desc") || "Quickly open the search dialog.",
    },
    toggleQueue: {
      title: t("settings.shortcuts.toggle_queue") || "Queue",
      desc: t("settings.shortcuts.toggle_queue_desc") || "Open or close the playback queue panel.",
    },
    toggleLyrics: {
      title: t("settings.shortcuts.toggle_lyrics") || "Lyrics",
      desc: t("settings.shortcuts.toggle_lyrics_desc") || "Open or close synchronized lyrics panel.",
    },
    toggleFullscreen: {
      title: t("settings.shortcuts.toggle_fullscreen") || "Fullscreen / Player view",
      desc: t("settings.shortcuts.toggle_fullscreen_desc") || "Toggle immersive fullscreen player view.",
    },
  };

  // Labels for Miniplayer Actions
  const miniplayerLabels: Record<keyof MiniplayerShortcutsSettings, { title: string; desc: string }> = {
    playPause: {
      title: t("settings.shortcuts.play_pause") || "Play / Pause",
      desc: t("settings.shortcuts.play_pause_desc") || "Toggle audio playback in miniplayer.",
    },
    nextTrack: {
      title: t("settings.shortcuts.next_track") || "Next track",
      desc: t("settings.shortcuts.next_track_desc") || "Skip to next song.",
    },
    prevTrack: {
      title: t("settings.shortcuts.prev_track") || "Previous track",
      desc: t("settings.shortcuts.prev_track_desc") || "Return to previous song.",
    },
    likeTrack: {
      title: t("settings.shortcuts.like_track") || "Like / Unlike",
      desc: t("settings.shortcuts.like_track_desc") || "Add or remove track from favorite tracks.",
    },
    seekForward: {
      title: t("settings.shortcuts.seek_forward") || "Seek forward (+5s)",
      desc: t("settings.shortcuts.seek_forward_desc") || "Fast forward by 5 seconds.",
    },
    seekBackward: {
      title: t("settings.shortcuts.seek_backward") || "Seek backward (-5s)",
      desc: t("settings.shortcuts.seek_backward_desc") || "Rewind by 5 seconds.",
    },
    volumeUp: {
      title: t("settings.shortcuts.volume_up") || "Volume up",
      desc: t("settings.shortcuts.volume_up_desc") || "Increase volume by 5%.",
    },
    volumeDown: {
      title: t("settings.shortcuts.volume_down") || "Volume down",
      desc: t("settings.shortcuts.volume_down_desc") || "Decrease volume by 5%.",
    },
    focusMainWindow: {
      title: t("settings.shortcuts.focus_main_window") || "Switch to main window",
      desc: t("settings.shortcuts.focus_main_window_desc") || "Focus and bring the main application window to front.",
    },
  };

  // Conflict validation callback factories
  const validateGlobalCandidate = useCallback(
    (currentKey: keyof GlobalShortcutsSettings) => (candidate: string) => {
      const norm = normalizeShortcutToEnglish(candidate).toLowerCase();
      for (const [key, val] of Object.entries(global) as [keyof GlobalShortcutsSettings, string][]) {
        if (key !== currentKey && normalizeShortcutToEnglish(val).toLowerCase() === norm) {
          return { conflictWith: globalLabels[key].title };
        }
      }
      return null;
    },
    [global, globalLabels]
  );

  const validateMainAppCandidate = useCallback(
    (currentKey: keyof MainAppShortcutsSettings) => (candidate: string) => {
      const norm = normalizeShortcutToEnglish(candidate).toLowerCase();
      for (const [key, val] of Object.entries(mainApp) as [keyof MainAppShortcutsSettings, string][]) {
        if (key !== currentKey && normalizeShortcutToEnglish(val).toLowerCase() === norm) {
          return { conflictWith: mainAppLabels[key].title };
        }
      }
      return null;
    },
    [mainApp, mainAppLabels]
  );

  const validateMiniplayerCandidate = useCallback(
    (currentKey: keyof MiniplayerShortcutsSettings) => (candidate: string) => {
      const norm = normalizeShortcutToEnglish(candidate).toLowerCase();
      for (const [key, val] of Object.entries(miniplayer) as [keyof MiniplayerShortcutsSettings, string][]) {
        if (key !== currentKey && normalizeShortcutToEnglish(val).toLowerCase() === norm) {
          return { conflictWith: miniplayerLabels[key].title };
        }
      }
      return null;
    },
    [miniplayer, miniplayerLabels]
  );

  const scopeTagLabels: Record<"global" | "mainApp" | "miniplayer", string> = {
    global: t("settings.shortcuts.scope_global") || "Global",
    mainApp: t("settings.shortcuts.scope_main_app") || "Main App",
    miniplayer: t("settings.shortcuts.scope_overlay") || "Overlay",
  };

  const scopeTagStyles: Record<"global" | "mainApp" | "miniplayer", string> = {
    global: "bg-amber-400/10 text-amber-300",
    mainApp: "bg-border-alpha-14 text-text-secondary",
    miniplayer: "bg-purple-400/10 text-purple-300",
  };

  interface ShortcutRowItem {
    id: string;
    scope: "global" | "mainApp" | "miniplayer";
    title: string;
    desc: string;
    icon: React.ComponentType<any>;
    value: string;
    defaultValue: string;
    onChange: (val: string) => void;
    onReset: () => void;
    validateCandidate: (candidate: string) => { conflictWith: string } | null;
  }

  const allItems: ShortcutRowItem[] = useMemo(() => {
    return [
      // Main App Actions
      {
        id: "mainApp-playPause",
        scope: "mainApp",
        title: mainAppLabels.playPause.title,
        desc: mainAppLabels.playPause.desc,
        icon: Play,
        value: mainApp.playPause,
        defaultValue: DEFAULT_SHORTCUTS.mainApp.playPause,
        onChange: (val) => setMainAppShortcut("playPause", val),
        onReset: () => resetShortcut("mainApp", "playPause"),
        validateCandidate: validateMainAppCandidate("playPause"),
      },
      {
        id: "mainApp-nextTrack",
        scope: "mainApp",
        title: mainAppLabels.nextTrack.title,
        desc: mainAppLabels.nextTrack.desc,
        icon: SkipNext,
        value: mainApp.nextTrack,
        defaultValue: DEFAULT_SHORTCUTS.mainApp.nextTrack,
        onChange: (val) => setMainAppShortcut("nextTrack", val),
        onReset: () => resetShortcut("mainApp", "nextTrack"),
        validateCandidate: validateMainAppCandidate("nextTrack"),
      },
      {
        id: "mainApp-prevTrack",
        scope: "mainApp",
        title: mainAppLabels.prevTrack.title,
        desc: mainAppLabels.prevTrack.desc,
        icon: SkipPrevious,
        value: mainApp.prevTrack,
        defaultValue: DEFAULT_SHORTCUTS.mainApp.prevTrack,
        onChange: (val) => setMainAppShortcut("prevTrack", val),
        onReset: () => resetShortcut("mainApp", "prevTrack"),
        validateCandidate: validateMainAppCandidate("prevTrack"),
      },
      {
        id: "mainApp-seekForward",
        scope: "mainApp",
        title: mainAppLabels.seekForward.title,
        desc: mainAppLabels.seekForward.desc,
        icon: FastForwardLine,
        value: mainApp.seekForward,
        defaultValue: DEFAULT_SHORTCUTS.mainApp.seekForward,
        onChange: (val) => setMainAppShortcut("seekForward", val),
        onReset: () => resetShortcut("mainApp", "seekForward"),
        validateCandidate: validateMainAppCandidate("seekForward"),
      },
      {
        id: "mainApp-seekBackward",
        scope: "mainApp",
        title: mainAppLabels.seekBackward.title,
        desc: mainAppLabels.seekBackward.desc,
        icon: FastRewindLine,
        value: mainApp.seekBackward,
        defaultValue: DEFAULT_SHORTCUTS.mainApp.seekBackward,
        onChange: (val) => setMainAppShortcut("seekBackward", val),
        onReset: () => resetShortcut("mainApp", "seekBackward"),
        validateCandidate: validateMainAppCandidate("seekBackward"),
      },
      {
        id: "mainApp-volumeUp",
        scope: "mainApp",
        title: mainAppLabels.volumeUp.title,
        desc: mainAppLabels.volumeUp.desc,
        icon: VolumeLoud,
        value: mainApp.volumeUp,
        defaultValue: DEFAULT_SHORTCUTS.mainApp.volumeUp,
        onChange: (val) => setMainAppShortcut("volumeUp", val),
        onReset: () => resetShortcut("mainApp", "volumeUp"),
        validateCandidate: validateMainAppCandidate("volumeUp"),
      },
      {
        id: "mainApp-volumeDown",
        scope: "mainApp",
        title: mainAppLabels.volumeDown.title,
        desc: mainAppLabels.volumeDown.desc,
        icon: VolumeSmall,
        value: mainApp.volumeDown,
        defaultValue: DEFAULT_SHORTCUTS.mainApp.volumeDown,
        onChange: (val) => setMainAppShortcut("volumeDown", val),
        onReset: () => resetShortcut("mainApp", "volumeDown"),
        validateCandidate: validateMainAppCandidate("volumeDown"),
      },
      {
        id: "mainApp-toggleMute",
        scope: "mainApp",
        title: mainAppLabels.toggleMute.title,
        desc: mainAppLabels.toggleMute.desc,
        icon: VolumeCross,
        value: mainApp.toggleMute,
        defaultValue: DEFAULT_SHORTCUTS.mainApp.toggleMute,
        onChange: (val) => setMainAppShortcut("toggleMute", val),
        onReset: () => resetShortcut("mainApp", "toggleMute"),
        validateCandidate: validateMainAppCandidate("toggleMute"),
      },
      {
        id: "mainApp-search",
        scope: "mainApp",
        title: mainAppLabels.search.title,
        desc: mainAppLabels.search.desc,
        icon: Search2Line,
        value: mainApp.search,
        defaultValue: DEFAULT_SHORTCUTS.mainApp.search,
        onChange: (val) => setMainAppShortcut("search", val),
        onReset: () => resetShortcut("mainApp", "search"),
        validateCandidate: validateMainAppCandidate("search"),
      },
      {
        id: "mainApp-toggleQueue",
        scope: "mainApp",
        title: mainAppLabels.toggleQueue.title,
        desc: mainAppLabels.toggleQueue.desc,
        icon: PlaylistFill,
        value: mainApp.toggleQueue,
        defaultValue: DEFAULT_SHORTCUTS.mainApp.toggleQueue,
        onChange: (val) => setMainAppShortcut("toggleQueue", val),
        onReset: () => resetShortcut("mainApp", "toggleQueue"),
        validateCandidate: validateMainAppCandidate("toggleQueue"),
      },
      {
        id: "mainApp-toggleLyrics",
        scope: "mainApp",
        title: mainAppLabels.toggleLyrics.title,
        desc: mainAppLabels.toggleLyrics.desc,
        icon: MusicNote,
        value: mainApp.toggleLyrics,
        defaultValue: DEFAULT_SHORTCUTS.mainApp.toggleLyrics,
        onChange: (val) => setMainAppShortcut("toggleLyrics", val),
        onReset: () => resetShortcut("mainApp", "toggleLyrics"),
        validateCandidate: validateMainAppCandidate("toggleLyrics"),
      },
      {
        id: "mainApp-toggleFullscreen",
        scope: "mainApp",
        title: mainAppLabels.toggleFullscreen.title,
        desc: mainAppLabels.toggleFullscreen.desc,
        icon: MaximizeSquare,
        value: mainApp.toggleFullscreen,
        defaultValue: DEFAULT_SHORTCUTS.mainApp.toggleFullscreen,
        onChange: (val) => setMainAppShortcut("toggleFullscreen", val),
        onReset: () => resetShortcut("mainApp", "toggleFullscreen"),
        validateCandidate: validateMainAppCandidate("toggleFullscreen"),
      },

      // Miniplayer Actions
      {
        id: "miniplayer-playPause",
        scope: "miniplayer",
        title: miniplayerLabels.playPause.title,
        desc: miniplayerLabels.playPause.desc,
        icon: Play,
        value: miniplayer.playPause,
        defaultValue: DEFAULT_SHORTCUTS.miniplayer.playPause,
        onChange: (val) => setMiniplayerShortcut("playPause", val),
        onReset: () => resetShortcut("miniplayer", "playPause"),
        validateCandidate: validateMiniplayerCandidate("playPause"),
      },
      {
        id: "miniplayer-nextTrack",
        scope: "miniplayer",
        title: miniplayerLabels.nextTrack.title,
        desc: miniplayerLabels.nextTrack.desc,
        icon: SkipNext,
        value: miniplayer.nextTrack,
        defaultValue: DEFAULT_SHORTCUTS.miniplayer.nextTrack,
        onChange: (val) => setMiniplayerShortcut("nextTrack", val),
        onReset: () => resetShortcut("miniplayer", "nextTrack"),
        validateCandidate: validateMiniplayerCandidate("nextTrack"),
      },
      {
        id: "miniplayer-prevTrack",
        scope: "miniplayer",
        title: miniplayerLabels.prevTrack.title,
        desc: miniplayerLabels.prevTrack.desc,
        icon: SkipPrevious,
        value: miniplayer.prevTrack,
        defaultValue: DEFAULT_SHORTCUTS.miniplayer.prevTrack,
        onChange: (val) => setMiniplayerShortcut("prevTrack", val),
        onReset: () => resetShortcut("miniplayer", "prevTrack"),
        validateCandidate: validateMiniplayerCandidate("prevTrack"),
      },
      {
        id: "miniplayer-likeTrack",
        scope: "miniplayer",
        title: miniplayerLabels.likeTrack.title,
        desc: miniplayerLabels.likeTrack.desc,
        icon: HeartLine,
        value: miniplayer.likeTrack,
        defaultValue: DEFAULT_SHORTCUTS.miniplayer.likeTrack,
        onChange: (val) => setMiniplayerShortcut("likeTrack", val),
        onReset: () => resetShortcut("miniplayer", "likeTrack"),
        validateCandidate: validateMiniplayerCandidate("likeTrack"),
      },
      {
        id: "miniplayer-seekForward",
        scope: "miniplayer",
        title: miniplayerLabels.seekForward.title,
        desc: miniplayerLabels.seekForward.desc,
        icon: FastForwardLine,
        value: miniplayer.seekForward,
        defaultValue: DEFAULT_SHORTCUTS.miniplayer.seekForward,
        onChange: (val) => setMiniplayerShortcut("seekForward", val),
        onReset: () => resetShortcut("miniplayer", "seekForward"),
        validateCandidate: validateMiniplayerCandidate("seekForward"),
      },
      {
        id: "miniplayer-seekBackward",
        scope: "miniplayer",
        title: miniplayerLabels.seekBackward.title,
        desc: miniplayerLabels.seekBackward.desc,
        icon: FastRewindLine,
        value: miniplayer.seekBackward,
        defaultValue: DEFAULT_SHORTCUTS.miniplayer.seekBackward,
        onChange: (val) => setMiniplayerShortcut("seekBackward", val),
        onReset: () => resetShortcut("miniplayer", "seekBackward"),
        validateCandidate: validateMiniplayerCandidate("seekBackward"),
      },
      {
        id: "miniplayer-volumeUp",
        scope: "miniplayer",
        title: miniplayerLabels.volumeUp.title,
        desc: miniplayerLabels.volumeUp.desc,
        icon: VolumeLoud,
        value: miniplayer.volumeUp,
        defaultValue: DEFAULT_SHORTCUTS.miniplayer.volumeUp,
        onChange: (val) => setMiniplayerShortcut("volumeUp", val),
        onReset: () => resetShortcut("miniplayer", "volumeUp"),
        validateCandidate: validateMiniplayerCandidate("volumeUp"),
      },
      {
        id: "miniplayer-volumeDown",
        scope: "miniplayer",
        title: miniplayerLabels.volumeDown.title,
        desc: miniplayerLabels.volumeDown.desc,
        icon: VolumeSmall,
        value: miniplayer.volumeDown,
        defaultValue: DEFAULT_SHORTCUTS.miniplayer.volumeDown,
        onChange: (val) => setMiniplayerShortcut("volumeDown", val),
        onReset: () => resetShortcut("miniplayer", "volumeDown"),
        validateCandidate: validateMiniplayerCandidate("volumeDown"),
      },
      {
        id: "miniplayer-focusMainWindow",
        scope: "miniplayer",
        title: miniplayerLabels.focusMainWindow.title,
        desc: miniplayerLabels.focusMainWindow.desc,
        icon: ExternalLinkLine,
        value: miniplayer.focusMainWindow,
        defaultValue: DEFAULT_SHORTCUTS.miniplayer.focusMainWindow,
        onChange: (val) => setMiniplayerShortcut("focusMainWindow", val),
        onReset: () => resetShortcut("miniplayer", "focusMainWindow"),
        validateCandidate: validateMiniplayerCandidate("focusMainWindow"),
      },

      // Global Actions
      {
        id: "global-toggleOverlay",
        scope: "global",
        title: globalLabels.toggleOverlay.title,
        desc: globalLabels.toggleOverlay.desc,
        icon: Widget5,
        value: global.toggleOverlay,
        defaultValue: DEFAULT_SHORTCUTS.global.toggleOverlay,
        onChange: (val) => setGlobalShortcut("toggleOverlay", val),
        onReset: () => resetShortcut("global", "toggleOverlay"),
        validateCandidate: validateGlobalCandidate("toggleOverlay"),
      },
      {
        id: "global-quickLikeSong",
        scope: "global",
        title: globalLabels.quickLikeSong.title,
        desc: globalLabels.quickLikeSong.desc,
        icon: HeartFill,
        value: global.quickLikeSong,
        defaultValue: DEFAULT_SHORTCUTS.global.quickLikeSong,
        onChange: (val) => setGlobalShortcut("quickLikeSong", val),
        onReset: () => resetShortcut("global", "quickLikeSong"),
        validateCandidate: validateGlobalCandidate("quickLikeSong"),
      },
    ];
  }, [
    global,
    mainApp,
    miniplayer,
    globalLabels,
    mainAppLabels,
    miniplayerLabels,
    setGlobalShortcut,
    setMainAppShortcut,
    setMiniplayerShortcut,
    resetShortcut,
    validateGlobalCandidate,
    validateMainAppCandidate,
    validateMiniplayerCandidate,
  ]);

  const effectiveQuery = (localSearchQuery || externalQuery || "").trim();
  const isSearching = Boolean(effectiveQuery);

  const filteredItems = useMemo(() => {
    if (isSearching) {
      const q = effectiveQuery.toLowerCase();
      return allItems.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.desc.toLowerCase().includes(q) ||
          scopeTagLabels[item.scope].toLowerCase().includes(q) ||
          item.value.toLowerCase().includes(q)
      );
    }
    return allItems.filter((item) => item.scope === activeScope);
  }, [allItems, isSearching, effectiveQuery, activeScope, scopeTagLabels]);

  const tabs = useMemo(
    () => [
      {
        value: "mainApp" as ScopeFilter,
        label: t("settings.shortcuts.tab_main_app") || "Main App",
        count: allItems.filter((i) => i.scope === "mainApp").length,
      },
      {
        value: "miniplayer" as ScopeFilter,
        label: t("settings.shortcuts.tab_overlay") || "Overlay",
        count: allItems.filter((i) => i.scope === "miniplayer").length,
      },
      {
        value: "global" as ScopeFilter,
        label: t("settings.shortcuts.tab_global") || "Global",
        count: allItems.filter((i) => i.scope === "global").length,
      },
    ],
    [t, allItems]
  );

  return (
    <div className="flex flex-col gap-3">
      {/* ── Top Bar: Scope Tabs (Left) + Tiny Search Field (Right) ── */}
      <div className="flex items-center justify-between gap-3">
        <div
          className="flex items-center gap-1 p-[3px] rounded-xl bg-border-alpha-14 select-none shrink-0"
          role="tablist"
          aria-label="Shortcut filter scopes"
        >
          {tabs.map((tab) => {
            const isActive = !isSearching && tab.value === activeScope;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  if (localSearchQuery) setLocalSearchQuery("");
                  setActiveScope(tab.value);
                }}
                className={`relative px-3.5 py-1.5 rounded-[9px] text-[13px] font-[500] transition-colors duration-150 border-0 outline-none cursor-pointer flex items-center gap-1.5 justify-center ${
                  isActive
                    ? "text-text-primary"
                    : "text-text-tertiary hover:text-text-primary bg-transparent"
                }`}
                style={font}
              >
                {isActive && (
                  <motion.div
                    layoutId="shortcutsScopeTab"
                    className="absolute inset-0 rounded-[9px] bg-bg-primary shadow-sm"
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 35,
                      mass: 0.7,
                    }}
                  />
                )}
                <span className="relative z-10 leading-none">{tab.label}</span>
                <span
                  className={`relative z-10 text-[11px] leading-none px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? "bg-border-alpha-14 text-text-secondary"
                      : "bg-transparent text-text-tertiary"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tiny Search Field */}
        <div className="relative flex items-center shrink-0">
          <div className="h-[30px] px-2.5 rounded-[9px] bg-border-alpha-10 hover:bg-border-alpha-14 focus-within:bg-border-alpha-14 flex items-center gap-1.5 transition-colors w-[165px] sm:w-[190px]">
            <Search2Line size={13} className="text-text-tertiary shrink-0" />
            <input
              type="text"
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              placeholder={t("settings.shortcuts.search_placeholder") || "Search shortcuts..."}
              className="w-full bg-transparent border-0 outline-none text-[12px] text-text-primary placeholder:text-text-tertiary p-0"
              style={font}
            />
            {localSearchQuery && (
              <button
                type="button"
                onClick={() => setLocalSearchQuery("")}
                aria-label="Clear search"
                className="text-text-tertiary hover:text-text-primary transition-colors border-0 bg-transparent p-0 cursor-pointer flex items-center justify-center shrink-0"
              >
                <CloseLine size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Action Rows List with Slide-Up Animation ── */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isSearching ? `search:${effectiveQuery}` : activeScope}
          initial={{ opacity: 0, y: 7 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          className="flex flex-col gap-0.5 mt-1"
        >
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-text-tertiary text-[13px]" style={font}>
              {t("search.no_results") || "No matching shortcuts found"}
            </div>
          ) : (
            filteredItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 px-3 py-2.5 rounded-xl hover:bg-border-alpha-10 transition-colors group select-none"
                >
                  {/* Left: Icon + Title + Scope Badge */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-text-tertiary group-hover:text-text-primary transition-colors shrink-0 flex items-center justify-center w-[20px] h-[20px]">
                      <Icon size={18} weight="Bold" />
                    </span>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[13.5px] font-[500] text-text-primary truncate" style={font}>
                        {item.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10.5px] font-[500] shrink-0 tracking-wide ${scopeTagStyles[item.scope]}`}
                        style={font}
                      >
                        {scopeTagLabels[item.scope]}
                      </span>
                    </div>
                  </div>

                  {/* Right: Shortcut Recorder */}
                  <ShortcutRecorder
                    value={item.value}
                    defaultValue={item.defaultValue}
                    onChange={item.onChange}
                    onReset={item.onReset}
                    isGlobal={item.scope === "global"}
                    validateCandidate={item.validateCandidate}
                  />
                </div>
              );
            })
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Global Reset Defaults Footer ── */}
      <div className="pt-4 pb-2 flex items-center justify-between border-t border-border-primary/40 mt-3">
        <div>
          <span className="text-[13px] font-[500] text-text-primary block" style={font}>
            {t("settings.shortcuts.reset_all") || "Reset all shortcuts"}
          </span>
          <span className="text-[12px] text-text-tertiary block mt-0.5" style={font}>
            {t("settings.shortcuts.reset_all_desc") ||
              "Restore factory default shortcuts for all sections."}
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={resetAll}
          className="!h-[30px] !px-3 !text-[12px] gap-1.5"
        >
          <Refresh size={14} className="text-text-tertiary" />
          {t("settings.shortcuts.reset_all_button") || "Reset defaults"}
        </Button>
      </div>
    </div>
  );
}

export default ShortcutsTab;
