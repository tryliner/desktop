import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThemeProvider } from "next-themes";
import {
  CloseLine,
  HeartFill,
  HeartLine,
  PauseFill,
  PlayFill,
  Settings4Fill,
} from "@mingcute/react";
import {
  PlaybackSpeed,
  Repeat,
  RepeatOne,
  Shuffle,
  SkipNext,
  SkipPrevious,
  Tuning2,
  VolumeCross,
  VolumeLoud,
  VolumeSmall,
} from "@solar-icons/react";
import type { Lyric } from "@braccato/parsers";
import type { LyricsClock } from "@/features/lyrics";
import type { RepeatMode } from "@/features/player/store/playerStore";
import { CanvasLyricsView } from "@/features/player/ui/CanvasLyricsView";
import { KawarpWrapper } from "@/features/player/ui/KawarpWrapper";
import AmbientLayer from "@/features/player/ui/AmbientLayer";
import { toVolumeGain, toVolumeLevel } from "@/features/player/engine/volume";
import { useLyricsPopupPreferencesStore } from "@/features/lyrics/store/lyricsPopupPreferencesStore";
import { EQ_BANDS, formatEqFrequency } from "@/features/player/engine/equalizer";
import "./globals.css";

interface PopupState {
  track: {
    id: string;
    title: string;
    artist: string;
    album: string;
    cover?: string;
    durationMs: number;
  } | null;
  kawarpEnabled: boolean;
  status: string;
  positionMs: number;
  positionAt: number;
  playbackRate: number;
  pitchSemitones: number;
  isPitchLinked: boolean;
  isReverbEnabled: boolean;
  reverbLevel: number;
  isEqEnabled: boolean;
  eqGains: number[];
  volume: number;
  repeat: RepeatMode;
  shuffle: boolean;
  liked: boolean;
  lyricsTrackId: string | null;
  lines: Lyric[];
  loading: boolean;
  instrumental: boolean;
}

const EMPTY: PopupState = {
  track: null,
  kawarpEnabled: false,
  status: "idle",
  positionMs: 0,
  positionAt: 0,
  playbackRate: 1,
  pitchSemitones: 0,
  isPitchLinked: true,
  isReverbEnabled: false,
  reverbLevel: 0.35,
  isEqEnabled: false,
  eqGains: [],
  volume: 0.7,
  repeat: "off",
  shuffle: false,
  liked: false,
  lyricsTrackId: null,
  lines: [],
  loading: false,
  instrumental: false,
};

function PreferenceToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-[9px] border-0 bg-transparent px-2 py-2 text-left text-[12px] text-white/85 transition-colors hover:bg-white/[0.06]"
    >
      <span>{label}</span>
      <span
        className={`relative h-[18px] w-[31px] shrink-0 rounded-full transition-colors ${checked ? "bg-white/85" : "bg-white/20"}`}
      >
        <span
          className={`absolute top-[3px] h-3 w-3 rounded-full transition-[left,background] ${checked ? "left-[16px] bg-black" : "left-[3px] bg-white/80"}`}
        />
      </span>
    </button>
  );
}

function PreferenceSlider({
  label,
  value,
  min,
  max,
  step,
  valueLabel,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  valueLabel?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block px-2 py-2">
      <span className="mb-1.5 flex items-center justify-between text-[11px] text-white/65">
        <span>{label}</span>
        <span className="tabular-nums text-white/45">{valueLabel ?? `${Math.round(value * (max <= 1 ? 100 : 1))}${max <= 1 ? "%" : "px"}`}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="lyrics-popup__range w-full"
      />
    </label>
  );
}

type PopupAction =
  | "togglePlay"
  | "next"
  | "prev"
  | "like"
  | "toggleShuffle"
  | "cycleRepeat"
  | "setPlaybackRate"
  | "setPitchSemitones"
  | "setPitchLinked"
  | "setReverbEnabled"
  | "setReverbLevel"
  | "setEqEnabled"
  | "setEqGains";

function PopupModeControls({
  shuffle,
  repeat,
  liked,
  onAction,
}: {
  shuffle: boolean;
  repeat: RepeatMode;
  liked: boolean;
  onAction: (action: PopupAction) => void;
}) {
  const repeatLabel =
    repeat === "one" ? "Repeat track" : repeat === "all" ? "Repeat queue" : "Repeat off";
  return (
    <>
      <button
        type="button"
        className={`lyrics-popup__button ${shuffle ? "lyrics-popup__button--active" : ""}`}
        aria-label={shuffle ? "Turn shuffle off" : "Turn shuffle on"}
        aria-pressed={shuffle}
        title={shuffle ? "Shuffle on" : "Shuffle off"}
        onClick={() => onAction("toggleShuffle")}
      >
        <Shuffle size={17} weight="Outline" />
      </button>
      <button
        type="button"
        className={`lyrics-popup__button ${repeat !== "off" ? "lyrics-popup__button--active" : ""}`}
        aria-label={repeatLabel}
        aria-pressed={repeat !== "off"}
        title={repeatLabel}
        onClick={() => onAction("cycleRepeat")}
      >
        {repeat === "one" ? (
          <RepeatOne size={17} weight="Outline" />
        ) : (
          <Repeat size={17} weight="Outline" />
        )}
      </button>
      <button
        type="button"
        className={`lyrics-popup__button ${liked ? "lyrics-popup__button--liked" : ""}`}
        aria-label={liked ? "Unlike track" : "Like track"}
        aria-pressed={liked}
        title={liked ? "Unlike track" : "Like track"}
        onClick={() => onAction("like")}
      >
        {liked ? <HeartFill size={17} /> : <HeartLine size={17} />}
      </button>
    </>
  );
}

export default function LyricsPopupApp() {
  const [state, setState] = useState<PopupState>(EMPTY);
  const [isEntering, setIsEntering] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const preferences = useLyricsPopupPreferencesStore();
  const updatePreference = preferences.updatePreference;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeToolPanel, setActiveToolPanel] = useState<"speed" | "eq" | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null);
  const [kawarpLoadedCover, setKawarpLoadedCover] = useState<string | null>(null);
  const hideControlsTimer = useRef<number | null>(null);
  const pointerInsidePopup = useRef(false);
  const keepControlsVisible = useRef(false);
  const autoHideControls = useRef(preferences.autoHideControls);
  autoHideControls.current = preferences.autoHideControls;
  keepControlsVisible.current = settingsOpen || activeToolPanel !== null;
  const showControls = useCallback(() => {
    if (hideControlsTimer.current !== null) {
      window.clearTimeout(hideControlsTimer.current);
      hideControlsTimer.current = null;
    }
    setControlsVisible(true);
  }, []);
  const scheduleControlsHide = useCallback(() => {
    if (hideControlsTimer.current !== null)
      window.clearTimeout(hideControlsTimer.current);
    if (!autoHideControls.current) {
      hideControlsTimer.current = null;
      return;
    }
    hideControlsTimer.current = window.setTimeout(() => {
      hideControlsTimer.current = null;
      if (
        !keepControlsVisible.current &&
        (!pointerInsidePopup.current || !document.hasFocus())
      ) {
        setControlsVisible(false);
      }
    }, 3000);
  }, []);

  useEffect(() => {
    if (!preferences.autoHideControls) showControls();
    else if (!pointerInsidePopup.current || !document.hasFocus())
      scheduleControlsHide();
  }, [preferences.autoHideControls, scheduleControlsHide, showControls]);
  const clockListeners = useRef(new Set<() => void>());
  const clock = useMemo<LyricsClock>(
    () => ({
      timeMs: () => {
        const current = stateRef.current;
        if (current.status !== "playing") return current.positionMs;
        const extrapolated =
          current.positionMs +
          Math.max(0, Date.now() - current.positionAt) * current.playbackRate;
        return current.track?.durationMs
          ? Math.min(current.track.durationMs, extrapolated)
          : extrapolated;
      },
      playing: () => stateRef.current.status === "playing",
      subscribe: (listener) => {
        clockListeners.current.add(listener);
        return () => clockListeners.current.delete(listener);
      },
    }),
    [],
  );

  useEffect(() => {
    return window.linerElectron?.onLyricsPopupShown(() => setIsEntering(true));
  }, []);

  useEffect(() => {
    const onFocus = () => {
      showControls();
      if (!pointerInsidePopup.current) scheduleControlsHide();
    };
    const onBlur = () => scheduleControlsHide();
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    scheduleControlsHide();
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      if (hideControlsTimer.current !== null)
        window.clearTimeout(hideControlsTimer.current);
    };
  }, [scheduleControlsHide, showControls]);

  useEffect(() => {
    let receivedState = false;
    let latestClock: Partial<PopupState> = {};
    const off = window.linerElectron?.onLyricsPopupState((next: PopupState) => {
      receivedState = true;
      stateRef.current = next;
      setState(next);
      for (const listener of clockListeners.current) listener();
    });
    const offClock = window.linerElectron?.onLyricsPopupClock(
      (clockUpdate: Partial<PopupState>) => {
        latestClock = { ...latestClock, ...clockUpdate };
        stateRef.current = { ...stateRef.current, ...clockUpdate };
        setState((current) => ({ ...current, ...clockUpdate }));
        for (const listener of clockListeners.current) listener();
      },
    );
    void window.linerElectron?.lyricsPopupGetState().then((latest: PopupState | null) => {
      // The main process may have sent its cached state before React attached
      // the IPC listeners. Request it after subscribing to close that race.
      if (!latest || receivedState) return;
      const restored = { ...latest, ...latestClock };
      stateRef.current = restored;
      setState(restored);
      for (const listener of clockListeners.current) listener();
    }).catch((error: unknown) => {
      console.error("Lyrics pop-up state restore failed:", error);
    });
    return () => {
      receivedState = true;
      off?.();
      offClock?.();
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen && activeToolPanel === null) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSettingsOpen(false);
        setActiveToolPanel(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [settingsOpen, activeToolPanel]);

  const lyrics = useMemo(
    () => (state.lyricsTrackId === state.track?.id ? state.lines : []),
    [state.lines, state.lyricsTrackId, state.track?.id],
  );
  const sendAction = (action: PopupAction, payload?: unknown) =>
    window.linerElectron?.lyricsPopupAction(action, payload);
  const onKawarpLoad = useCallback(() => {
    const loadedCover = stateRef.current.track?.cover;
    window.setTimeout(() => setKawarpLoadedCover(loadedCover ?? null), 500);
  }, []);
  const onKawarpError = useCallback((error: Error) => {
    console.error("Lyrics pop-up background failed to load:", error);
  }, []);
  const kawarpShown = Boolean(
    state.track?.cover && kawarpLoadedCover === state.track.cover,
  );
  const lyricsOnly = preferences.lyricsOnly;
  const showArtwork = preferences.showBackground && !lyricsOnly;
  const volume = volumeDraft ?? toVolumeLevel(state.volume);
  const VolumeIcon =
    volume <= 0 ? VolumeCross : volume < 0.34 ? VolumeSmall : VolumeLoud;
  const lyricEffects = [
    preferences.textShadow && preferences.shadowSize > 0
      ? `drop-shadow(0 2px ${preferences.shadowSize}px rgba(0, 0, 0, 1)) drop-shadow(0 0 ${preferences.shadowSize * 1.3}px rgba(0, 0, 0, 0.98))`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ThemeProvider attribute="data-theme" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
      <main
        className={`lyrics-popup group dark relative flex h-screen w-screen flex-col overflow-hidden text-white ${lyricsOnly ? "lyrics-popup--lyrics-only rounded-none" : "rounded-[14px]"} ${isEntering ? "lyrics-popup--entering" : ""}`}
        onMouseEnter={() => {
          pointerInsidePopup.current = true;
          showControls();
        }}
        onMouseMove={() => {
          pointerInsidePopup.current = true;
          showControls();
        }}
        onMouseLeave={() => {
          pointerInsidePopup.current = false;
          scheduleControlsHide();
        }}
        style={{
          backgroundColor: lyricsOnly
            ? "transparent"
            : showArtwork
              ? "transparent"
              : "rgba(18, 15, 18, 0.9)",
        }}
      >
        {showArtwork && (
          <div className="absolute inset-0 overflow-hidden rounded-[14px]">
            <div className="absolute inset-0 bg-bg-primary" />
            {state.track?.cover && (!kawarpShown || !state.kawarpEnabled) && (
              <img
                src={state.track.cover}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full scale-[1.3] object-cover"
                style={{ filter: "blur(64px) saturate(1.3)" }}
              />
            )}
            {state.kawarpEnabled && state.track?.cover && (
              <KawarpWrapper
                src={state.track.cover}
                onLoad={onKawarpLoad}
                onError={onKawarpError}
              />
            )}
            <AmbientLayer
              trackId={state.track?.id}
              playingOverride={state.status === "playing"}
            />
            <div
              className="absolute inset-0"
              style={{ backgroundColor: `rgba(0, 0, 0, ${preferences.backgroundDim})` }}
            />
          </div>
        )}

        <header
          className={`lyrics-popup__bar z-30 flex h-11 shrink-0 items-center gap-2.5 px-3 ${lyricsOnly ? "lyrics-popup__bar--lyrics-only absolute inset-x-0 top-0 justify-end" : "relative border-b border-white/[0.08]"}`}
        >
          {!lyricsOnly && (
            <>
              {state.track?.cover ? (
                <img
                  src={state.track.cover}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-[9px] object-cover shadow-lg"
                />
              ) : (
                <div className="h-8 w-8 shrink-0 rounded-[9px] bg-white/10" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold tracking-wide text-white/90">
                  {state.track?.title || "Liner Lyrics"}
                </div>
                <div className="truncate text-[11px] text-white/55">
                  {state.track?.artist || "Play something to see lyrics"}
                </div>
              </div>
            </>
          )}
          <div className="relative flex shrink-0 items-center gap-1">
            <div
              className={`lyrics-popup__topbar-tools flex items-center gap-0.5 ${controlsVisible ? "lyrics-popup__topbar-tools--visible" : ""}`}
            >
              {preferences.showSpeedPitchButton && (
                <button
                  type="button"
                  className="lyrics-popup__button"
                  title="Speed & pitch"
                  aria-label="Speed & pitch"
                  aria-expanded={activeToolPanel === "speed"}
                  onClick={() => {
                    showControls();
                    setSettingsOpen(false);
                    setActiveToolPanel((current) =>
                      current === "speed" ? null : "speed",
                    );
                  }}
                >
                  <PlaybackSpeed size={17} weight="Outline" />
                </button>
              )}
              {preferences.showEqualizerButton && (
                <button
                  type="button"
                  className="lyrics-popup__button"
                  title="Equalizer"
                  aria-label="Equalizer"
                  aria-expanded={activeToolPanel === "eq"}
                  onClick={() => {
                    showControls();
                    setSettingsOpen(false);
                    setActiveToolPanel((current) =>
                      current === "eq" ? null : "eq",
                    );
                  }}
                >
                  <Tuning2 size={16} weight="Outline" />
                </button>
              )}
            </div>
            <button
              type="button"
              className="lyrics-popup__button"
              title="Lyrics pop-up settings"
              aria-label="Lyrics pop-up settings"
              aria-expanded={settingsOpen}
              onClick={() => {
                showControls();
                setActiveToolPanel(null);
                setSettingsOpen((open) => !open);
              }}
            >
              <Settings4Fill size={16} />
            </button>
            <button
              type="button"
              className="lyrics-popup__button"
              title="Close window"
              aria-label="Close window"
              onClick={() => window.close()}
            >
              <CloseLine size={16} />
            </button>
            {activeToolPanel === "speed" && (
              <div className="lyrics-popup__settings-panel absolute right-0 top-[39px] z-50 w-[260px] max-w-[calc(100vw-16px)] max-h-[calc(100vh-120px)] overflow-y-auto rounded-[14px] border border-white/[0.09] bg-[#211c20]/95 p-2 shadow-2xl backdrop-blur-2xl">
                <div className="mb-1 flex items-center justify-between px-2 py-1">
                  <span className="text-[12px] font-semibold text-white/85">Speed & pitch</span>
                  <button
                    type="button"
                    className="lyrics-popup__button h-7 w-7"
                    onClick={() => setActiveToolPanel(null)}
                    aria-label="Close speed and pitch"
                  >
                    <CloseLine size={14} />
                  </button>
                </div>
                <PreferenceSlider
                  label="Speed"
                  value={state.playbackRate}
                  min={0.5}
                  max={2}
                  step={0.05}
                  valueLabel={`x${state.playbackRate.toFixed(2)}`}
                  onChange={(rate) => sendAction("setPlaybackRate", { rate })}
                />
                <PreferenceSlider
                  label="Pitch"
                  value={state.pitchSemitones}
                  min={-12}
                  max={12}
                  step={0.5}
                  valueLabel={`${state.pitchSemitones > 0 ? "+" : ""}${state.pitchSemitones.toFixed(1)} st`}
                  onChange={(semitones) =>
                    sendAction("setPitchSemitones", { semitones })
                  }
                />
                <PreferenceToggle
                  label="Link speed & pitch"
                  checked={state.isPitchLinked}
                  onChange={(linked) =>
                    sendAction("setPitchLinked", { linked })
                  }
                />
                <div className="my-1 border-t border-white/[0.08]" />
                <PreferenceToggle
                  label="Reverb"
                  checked={state.isReverbEnabled}
                  onChange={(enabled) =>
                    sendAction("setReverbEnabled", { enabled })
                  }
                />
                <PreferenceSlider
                  label="Reverb amount"
                  value={state.reverbLevel}
                  min={0}
                  max={1}
                  step={0.01}
                  valueLabel={`${Math.round(state.reverbLevel * 100)}%`}
                  onChange={(level) => sendAction("setReverbLevel", { level })}
                />
              </div>
            )}
            {activeToolPanel === "eq" && (
              <div className="lyrics-popup__settings-panel absolute right-0 top-[39px] z-50 w-[292px] max-w-[calc(100vw-16px)] max-h-[calc(100vh-120px)] overflow-y-auto rounded-[14px] border border-white/[0.09] bg-[#211c20]/95 p-2 shadow-2xl backdrop-blur-2xl">
                <div className="mb-1 flex items-center justify-between px-2 py-1">
                  <span className="text-[12px] font-semibold text-white/85">Equalizer</span>
                  <button
                    type="button"
                    className="lyrics-popup__button h-7 w-7"
                    onClick={() => setActiveToolPanel(null)}
                    aria-label="Close equalizer"
                  >
                    <CloseLine size={14} />
                  </button>
                </div>
                <PreferenceToggle
                  label="Equalizer"
                  checked={state.isEqEnabled}
                  onChange={(enabled) =>
                    sendAction("setEqEnabled", { enabled })
                  }
                />
                <div className="flex items-center justify-between px-2 pt-1 text-[10px] text-white/45">
                  <span>Frequency bands</span>
                  <button
                    type="button"
                    className="border-0 bg-transparent p-0 text-[10px] text-white/60 hover:text-white"
                    onClick={() =>
                      sendAction("setEqGains", {
                        gains: EQ_BANDS.map(() => 0),
                      })
                    }
                  >
                    Reset
                  </button>
                </div>
                <div className="flex flex-col gap-0.5 px-2 py-2">
                  {EQ_BANDS.map((frequency, index) => {
                    const gain = state.eqGains[index] ?? 0;
                    return (
                      <label
                        key={frequency}
                        className="grid h-7 grid-cols-[40px_minmax(0,1fr)_48px] items-center gap-2 text-[10px] text-white/60"
                      >
                        <span className="w-10 shrink-0 whitespace-nowrap">
                          {formatEqFrequency(frequency)}
                        </span>
                        <input
                          className="lyrics-popup__range min-w-0 w-full"
                          type="range"
                          min={-12}
                          max={12}
                          step={0.5}
                          value={gain}
                          aria-label={`${formatEqFrequency(frequency)} Hz`}
                          onChange={(event) => {
                            const gains = EQ_BANDS.map(
                              (_, bandIndex) => state.eqGains[bandIndex] ?? 0,
                            );
                            gains[index] = Number(event.currentTarget.value);
                            sendAction("setEqGains", { gains });
                          }}
                        />
                        <span className="w-12 whitespace-nowrap text-right tabular-nums">
                          {gain > 0 ? "+" : ""}{gain.toFixed(1)} dB
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            {settingsOpen && (
              <div className="lyrics-popup__settings-panel absolute right-0 top-[39px] z-50 w-[242px] max-h-[calc(100vh-120px)] overflow-y-auto rounded-[14px] border border-white/[0.09] bg-[#211c20]/95 p-2 shadow-2xl backdrop-blur-2xl">
                <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
                  Appearance
                </div>
                <PreferenceToggle
                  label="Lyrics only"
                  checked={preferences.lyricsOnly}
                  onChange={(value) => updatePreference("lyricsOnly", value)}
                />
                <PreferenceToggle
                  label="Artwork background"
                  checked={preferences.showBackground}
                  onChange={(value) => updatePreference("showBackground", value)}
                />
                {preferences.showBackground && !lyricsOnly && (
                  <PreferenceSlider
                    label="Background dim"
                    value={preferences.backgroundDim}
                    min={0.1}
                    max={0.85}
                    step={0.05}
                    onChange={(value) => updatePreference("backgroundDim", value)}
                  />
                )}
                <PreferenceToggle
                  label="Text shadow"
                  checked={preferences.textShadow}
                  onChange={(value) => updatePreference("textShadow", value)}
                />
                {preferences.textShadow && (
                  <PreferenceSlider
                    label="Shadow strength"
                    value={preferences.shadowSize}
                    min={0}
                    max={48}
                    step={1}
                    onChange={(value) => updatePreference("shadowSize", value)}
                  />
                )}
                <PreferenceSlider
                  label="Lyrics opacity"
                  value={preferences.lyricsOpacity}
                  min={0.35}
                  max={1}
                  step={0.05}
                  onChange={(value) => updatePreference("lyricsOpacity", value)}
                />
                <PreferenceToggle
                  label="Use custom lyric color"
                  checked={preferences.useCustomLyricsColor}
                  onChange={(value) =>
                    updatePreference("useCustomLyricsColor", value)
                  }
                />
                {preferences.useCustomLyricsColor && (
                  <label className="flex items-center justify-between rounded-[9px] px-2 py-2 text-[12px] text-white/75">
                    <span>Lyric color</span>
                    <input
                      type="color"
                      aria-label="Lyric color"
                      value={preferences.lyricsColor}
                      onChange={(event) =>
                        updatePreference("lyricsColor", event.currentTarget.value)
                      }
                      className="h-7 w-9 cursor-pointer rounded-md border border-white/15 bg-transparent p-0.5"
                    />
                  </label>
                )}
                <PreferenceToggle
                  label="Lyric glow"
                  checked={preferences.textGlow}
                  onChange={(value) => updatePreference("textGlow", value)}
                />
                {preferences.textGlow && (
                  <PreferenceSlider
                    label="Glow strength"
                    value={preferences.glowSize}
                    min={0}
                    max={36}
                    step={1}
                    onChange={(value) => updatePreference("glowSize", value)}
                  />
                )}
                {!lyricsOnly && (
                  <PreferenceToggle
                    label="Window shadow"
                    checked={preferences.windowShadow}
                    onChange={(value) => updatePreference("windowShadow", value)}
                  />
                )}
              </div>
            )}
          </div>
        </header>

        <section
          className={`relative z-10 flex min-h-0 flex-1 flex-col ${lyricsOnly ? "px-1 pt-9 pb-14" : "px-4 py-2"}`}
          style={{
            opacity: preferences.lyricsOpacity,
            filter: lyricEffects || undefined,
          }}
        >
          {state.track && lyrics.length > 0 ? (
            <CanvasLyricsView
              key={state.track.id}
              lyrics={lyrics}
              clock={clock}
              onSeek={(positionMs) =>
                window.linerElectron?.lyricsPopupSeek(positionMs)
              }
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              {state.track?.cover && !lyricsOnly && (
                <img
                  src={state.track.cover}
                  alt=""
                  className="mb-4 h-16 w-16 rounded-xl object-cover shadow-xl"
                />
              )}
              <p className="text-sm font-semibold text-white/85">
                {state.loading
                  ? "Finding lyrics…"
                  : state.instrumental
                    ? "Instrumental"
                    : state.track
                      ? "No lyrics found"
                      : "Nothing playing"}
              </p>
              {!lyricsOnly && (
                <p className="mt-1.5 max-w-[240px] text-[11px] leading-relaxed text-white/50">
                  {state.track
                    ? `${state.track.title} · ${state.track.artist}`
                    : "Start playback and lyrics will appear here."}
                </p>
              )}
            </div>
          )}
        </section>

        {!lyricsOnly && (
          <footer className={`lyrics-popup__footer relative z-30 flex h-[61px] shrink-0 flex-col items-center justify-center gap-1 border-t border-white/[0.08] px-3 py-1.5 ${controlsVisible ? "" : "lyrics-popup__footer--hidden"}`}>
            <div className="flex h-8 items-center justify-center gap-1">
              <button className="lyrics-popup__button" aria-label="Previous track" title="Previous track" onClick={() => sendAction("prev")}>
                <SkipPrevious size={18} weight="Outline" />
              </button>
              <button
                className="lyrics-popup__button lyrics-popup__play"
                aria-label={state.status === "playing" ? "Pause" : "Play"}
                title={state.status === "playing" ? "Pause" : "Play"}
                onClick={() => sendAction("togglePlay")}
              >
                {state.status === "playing" ? <PauseFill size={17} /> : <PlayFill size={17} />}
              </button>
              <button className="lyrics-popup__button" aria-label="Next track" title="Next track" onClick={() => sendAction("next")}>
                <SkipNext size={18} weight="Outline" />
              </button>
              <PopupModeControls
                shuffle={state.shuffle}
                repeat={state.repeat}
                liked={state.liked}
                onAction={sendAction}
              />
            </div>
            <div className="flex h-4 w-full items-center gap-2 px-1">
              <VolumeIcon size={14} className="shrink-0 text-white/60" />
              <input
                aria-label="Volume"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(event) => {
                  const next = Number(event.currentTarget.value);
                  setVolumeDraft(next);
                  window.linerElectron?.lyricsPopupSetVolume(toVolumeGain(next));
                }}
                onPointerUp={() => setVolumeDraft(null)}
                onPointerCancel={() => setVolumeDraft(null)}
                className="lyrics-popup__range min-w-0 flex-1"
              />
              <span className="w-7 text-right text-[9px] tabular-nums text-white/45">
                {Math.round(volume * 100)}
              </span>
            </div>
          </footer>
        )}
        {lyricsOnly && (
          <div className={`lyrics-popup__lyrics-only-controls absolute bottom-2 right-2 z-30 flex items-center gap-1 rounded-full border border-white/10 bg-black/45 px-1 py-0.5 shadow-lg backdrop-blur-xl ${controlsVisible ? "lyrics-popup__lyrics-only-controls--visible" : ""}`}>
            <PopupModeControls
              shuffle={state.shuffle}
              repeat={state.repeat}
              liked={state.liked}
              onAction={sendAction}
            />
          </div>
        )}
      </main>
    </ThemeProvider>
  );
}
