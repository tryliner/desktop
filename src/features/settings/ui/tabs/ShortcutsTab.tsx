import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  SkipNext,
  SkipPrevious,
  VolumeLoud,
  VolumeSmall,
  VolumeCross,
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
import { useTranslation } from "@/languages";
import { ConfirmPill, useToast } from "@/shared/ui";
import {
  useShortcutsStore,
  normalizeShortcutToEnglish,
  DEFAULT_SHORTCUTS,
  OPTIONAL_GLOBAL_ACTIONS,
  type OptionalGlobalAction,
  type GlobalShortcutsSettings,
  type MainAppShortcutsSettings,
  type MiniplayerShortcutsSettings,
  type GlobalShortcutState,
  type VolumeStep,
  VOLUME_STEP_OPTIONS,
  formatAcceleratorForDisplay,
  subscribeToGlobalShortcutStatus,
} from "@/features/shortcuts";
import { ShortcutRecorder } from "@/features/shortcuts/ui/ShortcutRecorder";
import { SegmentedControl, SettingRow, SettingSection } from "../controls";
import { useElementSize } from "@/shared/hooks/useElementSize";

type VolumeStepOption = `${number}`;

function toStepOption(step: VolumeStep): VolumeStepOption {
  return String(Math.round(step * 100)) as VolumeStepOption;
}

function fromStepOption(option: VolumeStepOption): VolumeStep {
  const step = Number(option) / 100;
  return (
    VOLUME_STEP_OPTIONS.find((candidate) => candidate === step) ??
    VOLUME_STEP_OPTIONS[2]
  );
}

type ScopeFilter = "mainApp" | "miniplayer" | "global";

const LIST_RESIZE_TRANSITION = "height 260ms cubic-bezier(0.32, 0.72, 0, 1)";

const OPTIONAL_GLOBAL_ICONS: Record<
  OptionalGlobalAction,
  React.ComponentType<any>
> = {
  playPause: Play,
  nextTrack: SkipNext,
  prevTrack: SkipPrevious,
  seekForward: FastForwardLine,
  seekBackward: FastRewindLine,
  volumeUp: VolumeLoud,
  volumeDown: VolumeSmall,
  toggleMute: VolumeCross,
  showMainWindow: ExternalLinkLine,
};

export function ShortcutsTab({
  searchQuery: externalQuery,
}: {
  searchQuery?: string;
}) {
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const isRu = locale === "ru";
  const [activeScope, setActiveScope] = useState<ScopeFilter>("mainApp");
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const listSize = useElementSize<HTMLDivElement>();
  const listHeight = listSize.size?.height;
  const [listResizing, setListResizing] = useState(false);
  const previousListHeight = useRef(listHeight);

  useEffect(() => {
    const previous = previousListHeight.current;
    previousListHeight.current = listHeight;
    if (
      previous !== undefined &&
      listHeight !== undefined &&
      previous !== listHeight
    ) {
      setListResizing(true);
    }
  }, [listHeight]);

  useEffect(() => {
    if (!recordingId) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-shortcut-row]")) {
        setRecordingId(null);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [recordingId]);

  const global = useShortcutsStore((state) => state.global);
  const mainApp = useShortcutsStore((state) => state.mainApp);
  const miniplayer = useShortcutsStore((state) => state.miniplayer);

  const setMainAppShortcut = useShortcutsStore(
    (state) => state.setMainAppShortcut,
  );
  const setMiniplayerShortcut = useShortcutsStore(
    (state) => state.setMiniplayerShortcut,
  );
  const resetShortcut = useShortcutsStore((state) => state.resetShortcut);
  const resetAll = useShortcutsStore((state) => state.resetAll);
  const commitGlobalShortcut = useShortcutsStore(
    (state) => state.commitGlobalShortcut,
  );
  const globalStatus = useShortcutsStore((state) => state.globalStatus);
  const rejectedGlobal = useShortcutsStore((state) => state.rejectedGlobal);
  const clearRejectedGlobal = useShortcutsStore(
    (state) => state.clearRejectedGlobal,
  );
  const volumeStep = useShortcutsStore((state) => state.volumeStep);
  const setVolumeStep = useShortcutsStore((state) => state.setVolumeStep);
  const volumeHoldRepeats = useShortcutsStore(
    (state) => state.volumeHoldRepeats,
  );
  const setVolumeHoldRepeats = useShortcutsStore(
    (state) => state.setVolumeHoldRepeats,
  );

  useEffect(() => subscribeToGlobalShortcutStatus(), []);

  useEffect(() => {
    if (!rejectedGlobal) return;
    const keys = formatAcceleratorForDisplay(rejectedGlobal.shortcut);
    const message =
      rejectedGlobal.reason === "taken"
        ? t("settings.shortcuts.taken_not_saved", { shortcut: keys }) ||
          `${keys} is taken by the system or another app. Pick another one.`
        : t("settings.shortcuts.invalid_not_saved", { shortcut: keys }) ||
          `${keys} can't be used as a global shortcut. Pick another one.`;
    toast(message, "error");
    clearRejectedGlobal();
  }, [rejectedGlobal, clearRejectedGlobal, t, toast]);

  const handleConfirmResetAll = useCallback(() => {
    resetAll();
    toast(
      isRu ? "Все горячие клавиши сброшены" : "All shortcuts have been reset",
      "info",
    );
  }, [resetAll, toast, isRu]);

  // Labels for Global Actions
  const globalLabels: Record<
    keyof GlobalShortcutsSettings,
    { title: string; desc: string }
  > = useMemo(
    () => ({
      toggleOverlay: {
        title:
          t("settings.shortcuts.toggle_overlay") || "Toggle miniplayer overlay",
        desc:
          t("settings.shortcuts.toggle_overlay_desc") ||
          "Show or hide the floating desktop overlay from anywhere in the OS.",
      },
      quickLikeSong: {
        title:
          t("settings.shortcuts.quick_like_song") || "Quick like current song",
        desc:
          t("settings.shortcuts.quick_like_song_desc") ||
          "Like or unlike current playing track system-wide without focusing the player.",
      },
      playPause: {
        title: t("settings.shortcuts.play_pause") || "Play / Pause",
        desc:
          t("settings.shortcuts.play_pause_desc") || "Toggle audio playback.",
      },
      nextTrack: {
        title: t("settings.shortcuts.next_track") || "Next track",
        desc:
          t("settings.shortcuts.next_track_desc") ||
          "Skip to the next song in the queue.",
      },
      prevTrack: {
        title: t("settings.shortcuts.prev_track") || "Previous track",
        desc:
          t("settings.shortcuts.prev_track_desc") ||
          "Return to previous track or track start.",
      },
      seekForward: {
        title: t("settings.shortcuts.seek_forward") || "Seek forward (+5s)",
        desc:
          t("settings.shortcuts.seek_forward_desc") ||
          "Fast forward playback position by 5 seconds.",
      },
      seekBackward: {
        title: t("settings.shortcuts.seek_backward") || "Seek backward (-5s)",
        desc:
          t("settings.shortcuts.seek_backward_desc") ||
          "Rewind playback position by 5 seconds.",
      },
      volumeUp: {
        title: t("settings.shortcuts.volume_up") || "Volume up",
        desc:
          t("settings.shortcuts.volume_up_desc") ||
          "Increase playback volume by 5%.",
      },
      volumeDown: {
        title: t("settings.shortcuts.volume_down") || "Volume down",
        desc:
          t("settings.shortcuts.volume_down_desc") ||
          "Decrease playback volume by 5%.",
      },
      toggleMute: {
        title: t("settings.shortcuts.toggle_mute") || "Mute / Unmute",
        desc:
          t("settings.shortcuts.toggle_mute_desc") ||
          "Toggle audio mute state.",
      },
      showMainWindow: {
        title: t("settings.shortcuts.show_main_window") || "Show Liner",
        desc:
          t("settings.shortcuts.show_main_window_desc") ||
          "Bring the main Liner window to the front.",
      },
    }),
    [t],
  );

  // Labels for Main App Actions
  const mainAppLabels: Record<
    keyof MainAppShortcutsSettings,
    { title: string; desc: string }
  > = useMemo(
    () => ({
      playPause: {
        title: t("settings.shortcuts.play_pause") || "Play / Pause",
        desc:
          t("settings.shortcuts.play_pause_desc") || "Toggle audio playback.",
      },
      nextTrack: {
        title: t("settings.shortcuts.next_track") || "Next track",
        desc:
          t("settings.shortcuts.next_track_desc") ||
          "Skip to the next song in the queue.",
      },
      prevTrack: {
        title: t("settings.shortcuts.prev_track") || "Previous track",
        desc:
          t("settings.shortcuts.prev_track_desc") ||
          "Return to previous track or track start.",
      },
      seekForward: {
        title: t("settings.shortcuts.seek_forward") || "Seek forward (+5s)",
        desc:
          t("settings.shortcuts.seek_forward_desc") ||
          "Fast forward playback position by 5 seconds.",
      },
      seekBackward: {
        title: t("settings.shortcuts.seek_backward") || "Seek backward (-5s)",
        desc:
          t("settings.shortcuts.seek_backward_desc") ||
          "Rewind playback position by 5 seconds.",
      },
      volumeUp: {
        title: t("settings.shortcuts.volume_up") || "Volume up",
        desc:
          t("settings.shortcuts.volume_up_desc") ||
          "Increase playback volume by 5%.",
      },
      volumeDown: {
        title: t("settings.shortcuts.volume_down") || "Volume down",
        desc:
          t("settings.shortcuts.volume_down_desc") ||
          "Decrease playback volume by 5%.",
      },
      toggleMute: {
        title: t("settings.shortcuts.toggle_mute") || "Mute / Unmute",
        desc:
          t("settings.shortcuts.toggle_mute_desc") ||
          "Toggle audio mute state.",
      },
      search: {
        title: t("settings.shortcuts.search") || "Search music",
        desc:
          t("settings.shortcuts.search_desc") ||
          "Quickly open the search dialog.",
      },
      toggleQueue: {
        title: t("settings.shortcuts.toggle_queue") || "Queue",
        desc:
          t("settings.shortcuts.toggle_queue_desc") ||
          "Open or close the playback queue panel.",
      },
      toggleFullscreen: {
        title:
          t("settings.shortcuts.toggle_fullscreen") ||
          "Fullscreen / Player view",
        desc:
          t("settings.shortcuts.toggle_fullscreen_desc") ||
          "Toggle immersive fullscreen player view.",
      },
    }),
    [t],
  );

  // Labels for Miniplayer Actions
  const miniplayerLabels: Record<
    keyof MiniplayerShortcutsSettings,
    { title: string; desc: string }
  > = useMemo(
    () => ({
      playPause: {
        title: t("settings.shortcuts.play_pause") || "Play / Pause",
        desc:
          t("settings.shortcuts.play_pause_desc") ||
          "Toggle audio playback in miniplayer.",
      },
      nextTrack: {
        title: t("settings.shortcuts.next_track") || "Next track",
        desc: t("settings.shortcuts.next_track_desc") || "Skip to next song.",
      },
      prevTrack: {
        title: t("settings.shortcuts.prev_track") || "Previous track",
        desc:
          t("settings.shortcuts.prev_track_desc") || "Return to previous song.",
      },
      likeTrack: {
        title: t("settings.shortcuts.like_track") || "Like / Unlike",
        desc:
          t("settings.shortcuts.like_track_desc") ||
          "Add or remove track from favorite tracks.",
      },
      seekForward: {
        title: t("settings.shortcuts.seek_forward") || "Seek forward (+5s)",
        desc:
          t("settings.shortcuts.seek_forward_desc") ||
          "Fast forward by 5 seconds.",
      },
      seekBackward: {
        title: t("settings.shortcuts.seek_backward") || "Seek backward (-5s)",
        desc:
          t("settings.shortcuts.seek_backward_desc") || "Rewind by 5 seconds.",
      },
      volumeUp: {
        title: t("settings.shortcuts.volume_up") || "Volume up",
        desc:
          t("settings.shortcuts.volume_up_desc") || "Increase volume by 5%.",
      },
      volumeDown: {
        title: t("settings.shortcuts.volume_down") || "Volume down",
        desc:
          t("settings.shortcuts.volume_down_desc") || "Decrease volume by 5%.",
      },
      focusMainWindow: {
        title:
          t("settings.shortcuts.focus_main_window") || "Switch to main window",
        desc:
          t("settings.shortcuts.focus_main_window_desc") ||
          "Focus and bring the main application window to front.",
      },
    }),
    [t],
  );

  // Conflict validation callback factories
  const validateGlobalCandidate = useCallback(
    (currentKey: keyof GlobalShortcutsSettings) => (candidate: string) => {
      const norm = normalizeShortcutToEnglish(candidate).toLowerCase();
      for (const [key, val] of Object.entries(global) as [
        keyof GlobalShortcutsSettings,
        string,
      ][]) {
        if (
          key !== currentKey &&
          normalizeShortcutToEnglish(val).toLowerCase() === norm
        ) {
          return { conflictWith: globalLabels[key].title };
        }
      }
      return null;
    },
    [global, globalLabels],
  );

  const validateMainAppCandidate = useCallback(
    (currentKey: keyof MainAppShortcutsSettings) => (candidate: string) => {
      const norm = normalizeShortcutToEnglish(candidate).toLowerCase();
      for (const [key, val] of Object.entries(mainApp) as [
        keyof MainAppShortcutsSettings,
        string,
      ][]) {
        if (
          key !== currentKey &&
          normalizeShortcutToEnglish(val).toLowerCase() === norm
        ) {
          return { conflictWith: mainAppLabels[key].title };
        }
      }
      return null;
    },
    [mainApp, mainAppLabels],
  );

  const validateMiniplayerCandidate = useCallback(
    (currentKey: keyof MiniplayerShortcutsSettings) => (candidate: string) => {
      const norm = normalizeShortcutToEnglish(candidate).toLowerCase();
      for (const [key, val] of Object.entries(miniplayer) as [
        keyof MiniplayerShortcutsSettings,
        string,
      ][]) {
        if (
          key !== currentKey &&
          normalizeShortcutToEnglish(val).toLowerCase() === norm
        ) {
          return { conflictWith: miniplayerLabels[key].title };
        }
      }
      return null;
    },
    [miniplayer, miniplayerLabels],
  );

  const scopeTagLabels: Record<"global" | "mainApp" | "miniplayer", string> =
    useMemo(
      () => ({
        global: t("settings.shortcuts.scope_global") || "Global",
        mainApp: t("settings.shortcuts.scope_main_app") || "Main App",
        miniplayer: t("settings.shortcuts.scope_overlay") || "Overlay",
      }),
      [t],
    );

  const scopeTagStyles: Record<"global" | "mainApp" | "miniplayer", string> = {
    global: "text-amber-300",
    mainApp: "text-text-tertiary",
    miniplayer: "text-purple-300",
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
    clearable?: boolean;
    status?: GlobalShortcutState;
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
        status: globalStatus.toggleOverlay,
        onChange: (val) => commitGlobalShortcut("toggleOverlay", val),
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
        status: globalStatus.quickLikeSong,
        onChange: (val) => commitGlobalShortcut("quickLikeSong", val),
        onReset: () => resetShortcut("global", "quickLikeSong"),
        validateCandidate: validateGlobalCandidate("quickLikeSong"),
      },
      ...OPTIONAL_GLOBAL_ACTIONS.map((action): ShortcutRowItem => ({
        id: `global-${action}`,
        scope: "global",
        title: globalLabels[action].title,
        desc: globalLabels[action].desc,
        icon: OPTIONAL_GLOBAL_ICONS[action],
        value: global[action],
        defaultValue: DEFAULT_SHORTCUTS.global[action],
        clearable: true,
        status: global[action] ? globalStatus[action] : undefined,
        onChange: (val) => commitGlobalShortcut(action, val),
        onReset: () => resetShortcut("global", action),
        validateCandidate: validateGlobalCandidate(action),
      })),
    ];
  }, [
    global,
    mainApp,
    miniplayer,
    globalLabels,
    mainAppLabels,
    miniplayerLabels,
    globalStatus,
    commitGlobalShortcut,
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
          item.value.toLowerCase().includes(q),
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
    [t, allItems],
  );

  return (
    <div className="flex flex-col">
      {/* ── Top Bar: Scope Tabs (Left) + Tiny Search Field (Right) ── */}
      <div className="flex items-center justify-between gap-3 mt-[8px] mb-[6px] w-full min-w-0">
        <div
          className="inline-flex h-[34px] items-center rounded-item bg-fill p-[3px] select-none shrink-0"
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
                className={`group relative inline-flex h-full items-center justify-center rounded-control ${
                  isRu ? "px-[11px]" : "px-[12px]"
                } text-body leading-none transition-colors duration-150 border-0 bg-transparent cursor-pointer select-none ${
                  isActive
                    ? "text-text-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
                style={{
                  fontWeight: 500,
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="shortcutsScopeTab"
                    className="absolute inset-0 rounded-control bg-fill-hover"
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 35,
                      mass: 0.7,
                    }}
                  />
                )}
                <span className="relative z-10 leading-none flex items-center gap-1.5">
                  <span className="leading-none">{tab.label}</span>
                  <span
                    className={`text-caption font-normal tabular-nums leading-none transition-colors ${
                      isActive
                        ? "text-text-secondary"
                        : "text-text-tertiary group-hover:text-text-secondary"
                    }`}
                  >
                    {tab.count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Tools: Search Field + Small Reset Button */}
        <div className="relative flex items-center justify-end flex-1 min-w-0 gap-2">
          <div className="h-[34px] px-3 rounded-[10px] bg-fill flex items-center gap-2 transition-colors w-full max-w-[220px] min-w-[130px] border-none outline-none ring-0">
            <Search2Line size={15} className="text-text-tertiary shrink-0" />
            <input
              type="text"
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              placeholder={
                t("settings.shortcuts.search_placeholder") ||
                "Search shortcuts..."
              }
              className="w-full bg-transparent border-none outline-none text-body text-text-primary placeholder:text-text-tertiary p-0 min-w-0 truncate"
            />
            {localSearchQuery && (
              <button
                type="button"
                onClick={() => setLocalSearchQuery("")}
                aria-label="Clear search"
                className="text-text-tertiary hover:text-text-primary transition-colors border-0 bg-transparent p-0 cursor-pointer flex items-center justify-center shrink-0"
              >
                <CloseLine size={14} />
              </button>
            )}
          </div>

          <ConfirmPill
            className="h-[34px]"
            label={t("settings.shortcuts.reset_all_button") || "Reset defaults"}
            actionLabel={
              t("settings.shortcuts.reset_all") || "Reset all shortcuts"
            }
            confirmLabel={t("common.confirm") || "Confirm"}
            onConfirm={handleConfirmResetAll}
          />
        </div>
      </div>

      {/* ── Action Rows List with Slide-Up Animation ── */}
      <div
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && e.propertyName === "height") {
            setListResizing(false);
          }
        }}
        style={{
          height: listHeight,
          transition: LIST_RESIZE_TRANSITION,
          overflow: listResizing ? "hidden" : "visible",
        }}
      >
        <div ref={listSize.attach} className="relative">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={isSearching ? `search:${effectiveQuery}` : activeScope}
              initial={{ opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className="flex flex-wrap gap-[8px] pt-[10px]"
            >
              {filteredItems.length === 0 ? (
                <div className="w-full py-8 text-center text-text-tertiary text-body">
                  {t("search.no_results") || "No matching shortcuts found"}
                </div>
              ) : (
                filteredItems.map((item) => {
                  const Icon = item.icon;
                  const isRowRecording = recordingId === item.id;
                  return (
                    <div
                      key={item.id}
                      data-shortcut-row={item.id}
                      onClick={() => {
                        setRecordingId((prev) =>
                          prev === item.id ? null : item.id,
                        );
                      }}
                      className="inline-flex min-h-[50px] items-center gap-[14px] rounded-[14px] bg-fill py-[8px] pl-[12px] pr-[8px] transition-colors group select-none cursor-pointer hover:bg-fill-hover"
                    >
                      {/* Left: Icon + Title + Scope Badge */}
                      <div className="flex items-center gap-[10px] min-w-0 pointer-events-none">
                        <span className="text-text-primary shrink-0 flex items-center justify-center w-[22px] h-[22px]">
                          <Icon size={20} weight="Bold" />
                        </span>
                        <div className="flex flex-col gap-[2px] min-w-0">
                          <span className="text-label font-[500] leading-tight text-text-primary truncate">
                            {item.title}
                          </span>
                          {item.status === "taken" ||
                          item.status === "invalid" ? (
                            <span
                              data-shortcut-status={item.status}
                              className="text-[11px] font-[500] leading-none text-rose-500 dark:text-rose-400"
                            >
                              {item.status === "taken"
                                ? t("settings.shortcuts.taken_by_other_app") ||
                                  "Taken by the system or another app"
                                : t("settings.shortcuts.invalid_global") ||
                                  "Can't be used as a global shortcut"}
                            </span>
                          ) : (
                            <span
                              className={`text-[11px] font-[500] leading-none ${scopeTagStyles[item.scope]}`}
                            >
                              {scopeTagLabels[item.scope]}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Shortcut Recorder */}
                      <ShortcutRecorder
                        value={item.value}
                        defaultValue={item.defaultValue}
                        onChange={(val) => {
                          item.onChange(val);
                          setRecordingId(null);
                        }}
                        onReset={item.onReset}
                        isGlobal={item.scope === "global"}
                        clearable={item.clearable}
                        validateCandidate={item.validateCandidate}
                        isRecording={isRowRecording}
                        onRecordingChange={(rec) =>
                          setRecordingId(rec ? item.id : null)
                        }
                      />
                    </div>
                  );
                })
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {isSearching ? null : (
        <div className="mt-[18px]">
          <SettingSection
            label={t("settings.shortcuts.volume_section") || "Volume hotkeys"}
          >
            <SettingRow
              title={
                t("settings.shortcuts.volume_hold.title") ||
                "When the key is held"
              }
              description={
                t("settings.shortcuts.volume_hold.description") ||
                "Keep changing the volume while a volume key is held, or change it once per press."
              }
              titleKey="settings.shortcuts.volume_hold.title"
              descKey="settings.shortcuts.volume_hold.description"
              control={
                <SegmentedControl
                  ariaLabel={
                    t("settings.shortcuts.volume_hold.title") ||
                    "When the key is held"
                  }
                  value={volumeHoldRepeats ? "hold" : "press"}
                  onChange={(next) => setVolumeHoldRepeats(next === "hold")}
                  options={[
                    {
                      value: "hold",
                      label:
                        t("settings.shortcuts.volume_hold.hold") ||
                        "Keep changing",
                    },
                    {
                      value: "press",
                      label:
                        t("settings.shortcuts.volume_hold.press") ||
                        "Once per press",
                    },
                  ]}
                />
              }
            />
            <SettingRow
              title={t("settings.shortcuts.volume_step.title") || "Volume step"}
              description={
                t("settings.shortcuts.volume_step.description") ||
                "How much one press of a volume key changes the volume."
              }
              titleKey="settings.shortcuts.volume_step.title"
              descKey="settings.shortcuts.volume_step.description"
              control={
                <SegmentedControl
                  ariaLabel={
                    t("settings.shortcuts.volume_step.title") || "Volume step"
                  }
                  value={toStepOption(volumeStep)}
                  onChange={(next) => setVolumeStep(fromStepOption(next))}
                  options={VOLUME_STEP_OPTIONS.map((step) => ({
                    value: toStepOption(step),
                    label: `${Math.round(step * 100)}%`,
                  }))}
                />
              }
            />
          </SettingSection>
        </div>
      )}
    </div>
  );
}

export default ShortcutsTab;
