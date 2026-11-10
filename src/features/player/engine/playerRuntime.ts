import { usePlayerStore } from "../store/playerStore";
import { ApiError } from "@/shared/api";
import { log } from "@/shared/utils/logger";
import { telemetry } from "@/shared/telemetry";
import { linerDb, audioCache } from "@/shared/storage";
import { isStandaloneAudioFile } from "@/shared/storage/audioFormat";
import type { Track } from "@/shared/types";
import { markLinerStreamFailed } from "@/shared/media/liner/linerPlayback";
import { isLocalTrackId } from "@/shared/media/local";
import { isSavedTrack } from "@/shared/media/saved";
import { pitchShifter } from "./pitchShifter";
import { FLAT_EQ, isEqActive } from "./equalizer";
import { resolvePlaybackStream, type PlaybackStream } from "./streamResolver";
import {
  GAPLESS_HEAD_START_MS,
  SKIP_FADE_MS,
  TRANSITION_ARM_WINDOW_MS,
  transitionMs,
  transitionTiming,
} from "./crossfade";
import {
  findOrCreateAudioElements,
  markActiveAudio,
  rampVolume,
} from "./audioElements";
import {
  releaseStandbySource,
  resolveStandbySource,
  type StandbySource,
} from "./standbySource";
import { logNowPlaying } from "./nowPlayingLog";
import {
  downloadAudioBytes,
  isBotCheckError,
  isYoutubeSignInDeclined,
  isYoutubeSignedIn,
  prefersSignInPrompt,
  requestYoutubeSignIn,
} from "@/shared/youtube";

// error recovery tuning (see the audio "error" handler)
const RECOVERY_HOLD_MS = 3000;
const WAITING_GRACE_MS = 300; // a buffering hiccup shorter than this never shows // must play this far past a recovery before it may retry again

export class PlayerRuntime {
  private audio: HTMLAudioElement;
  private standby: HTMLAudioElement;
  private standbySlot: { trackId: string; source: StandbySource } | null = null;
  private standbyEpoch = 0;
  private preloadTicket = 0;
  private pendingStandby: Track | null = null;
  private transitionTimer: ReturnType<typeof setTimeout> | null = null;
  private handoffTrackId: string | null = null;
  private finishOutgoing: (() => void) | null = null;
  private currentTrackId: string | null = null;
  private loadEpoch = 0;
  private loadAbortController: AbortController | null = null;
  private isResetting = false;
  private stopFade: (() => void) | null = null;
  private stallStartTime: number | null = null;
  private loadStartTime = 0;
  private ttfbMs = 0;
  private activePlayPromise: Promise<void> | null = null;
  private activeBlobUrl: string | null = null;
  private releaseActiveStream: (() => void) | null = null;
  // track whose audio is attached to the element right now. During a skip the old
  // source stays attached (paused) until the next one is ready, so this can lag
  // currentTrackId for a moment.
  private attachedTrackId: string | null = null;
  // the attached source is a presigned r2 url (not a blob, not youtube)
  private attachedFromLiner = false;
  private preloadingTrackId: string | null = null;
  private preloadingPromise: Promise<void> | null = null;
  private preloadAbortController: AbortController | null = null;
  private backgroundCacheAbortController: AbortController | null = null;
  private currentSessionExpiresAt: number | null = null;
  private recoveryAttempts = 0;
  // after a recovery, the retry budget only refills once playback gets past this
  // position: a "playing" event alone is not proof (a bad frame further on would
  // otherwise error -> recover -> play -> error forever, reloading every time)
  private recoveryHoldUntilMs: number | null = null;
  // a "waiting" only becomes the loading state if it lasts: a seek inside an already
  // loaded / cached track fires waiting -> playing within milliseconds, and flipping
  // the status for that re-animated the play / pause button on every seek
  private waitingTimer: ReturnType<typeof setTimeout> | null = null;
  public onEnded?: () => void;
  public onError?: (info: { trackId: string; message: string }) => void;
  public peekAutoNext?: () => Track | null;

  constructor() {
    const { active, standby } = findOrCreateAudioElements();
    this.audio = active;
    this.standby = standby;
    this.setupAudioListeners(this.audio);
    this.setupAudioListeners(this.standby);

    const initialVolume = usePlayerStore.getState().volume;
    this.audio.volume = initialVolume;
    this.applyPlaybackRateAndPitch();
    log("cyan", "boot", `volume ${initialVolume}`);

    usePlayerStore.subscribe((state, prevState) => {
      if (state.status !== prevState.status) {
        this.syncMediaSessionState(state.status);
      }
      if (state.volume !== prevState.volume) {
        this.cancelFade();
        if (!this.audio.paused) {
          this.audio.volume = state.volume;
        }
      }
      if (
        state.playbackRate !== prevState.playbackRate ||
        state.isPitchLinked !== prevState.isPitchLinked ||
        state.pitchSemitones !== prevState.pitchSemitones ||
        state.isReverbEnabled !== prevState.isReverbEnabled ||
        state.reverbLevel !== prevState.reverbLevel ||
        state.isEqEnabled !== prevState.isEqEnabled ||
        state.eqGains !== prevState.eqGains
      ) {
        const rate = state.playbackRate ?? 1;
        const preservesPitch = !state.isPitchLinked;
        this.applyPlaybackRateAndPitch(rate, preservesPitch);
      }
    });

    this.setupDeviceChangeListener();
    this.setupMediaSession();
    log("green", "boot", "player runtime initialized");
  }

  private setupDeviceChangeListener() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;

    let initial = true;
    const onDeviceChange = () => {
      if (initial) {
        initial = false;
        return;
      }
      if (!usePlayerStore.getState().pauseOnDeviceChange) return;
      if (
        !this.audio.paused &&
        usePlayerStore.getState().status === "playing"
      ) {
        this.pause();
      }
    };

    try {
      navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
      void navigator.mediaDevices.enumerateDevices().then(() => {
        initial = false;
      });
    } catch {
      // ignore unsupported environments
    }
  }

  private setupMediaSession() {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator))
      return;

    try {
      navigator.mediaSession.setActionHandler("play", () => {
        usePlayerStore.getState().dispatch({ type: "RESUME_REQUESTED" });
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        usePlayerStore.getState().dispatch({ type: "PAUSE_REQUESTED" });
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        usePlayerStore.getState().dispatch({ type: "SKIP_PREVIOUS" });
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        usePlayerStore.getState().dispatch({ type: "SKIP_NEXT" });
      });
      navigator.mediaSession.setActionHandler("stop", () => {
        usePlayerStore.getState().dispatch({ type: "PAUSE_REQUESTED" });
      });
      const seekBy = (deltaSeconds: number) => {
        const st = usePlayerStore.getState();
        const max =
          st.durationMs > 0 ? st.durationMs : Number.POSITIVE_INFINITY;
        const next = Math.min(
          max,
          Math.max(0, st.positionMs + deltaSeconds * 1000),
        );
        st.dispatch({ type: "SEEK_COMMITTED", positionMs: Math.round(next) });
      };
      navigator.mediaSession.setActionHandler("seekbackward", (details) => {
        seekBy(-(details.seekOffset ?? 10));
      });
      navigator.mediaSession.setActionHandler("seekforward", (details) => {
        seekBy(details.seekOffset ?? 10);
      });
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime !== undefined && !Number.isNaN(details.seekTime)) {
          usePlayerStore.getState().dispatch({
            type: "SEEK_COMMITTED",
            positionMs: Math.round(details.seekTime * 1000),
          });
        }
      });
    } catch {
      // ignore unsupported media session actions
    }
  }

  // windows' media controls (and apps built on them, like FluentFlyout) read this.
  // "loading" between tracks still reports playing so the session never looks finished.
  private syncMediaSessionState(status: string) {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator))
      return;
    try {
      navigator.mediaSession.playbackState =
        status === "playing" || status === "loading"
          ? "playing"
          : status === "paused"
            ? "paused"
            : "none";
      if (status === "idle") navigator.mediaSession.metadata = null;
    } catch {
      // ignore unsupported environments
    }
  }

  // progress / seek bar in the system controls
  private syncMediaSessionPosition() {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator))
      return;
    const ms = navigator.mediaSession as MediaSession & {
      setPositionState?: (state?: MediaPositionState) => void;
    };
    if (typeof ms.setPositionState !== "function") return;
    if (this.attachedTrackId !== this.currentTrackId) return;
    const duration = this.audio.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    try {
      ms.setPositionState({
        duration,
        playbackRate: this.audio.playbackRate > 0 ? this.audio.playbackRate : 1,
        position: Math.min(duration, Math.max(0, this.audio.currentTime || 0)),
      });
    } catch {
      // ignore invalid transient states
    }
  }

  public updateMediaSessionMetadata(track: Track | null) {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator))
      return;
    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artists,
        album: (track as { albumTitle?: string }).albumTitle || "Liner",
        artwork: track.coverUrl
          ? [
              { src: track.coverUrl, sizes: "96x96", type: "image/jpeg" },
              { src: track.coverUrl, sizes: "256x256", type: "image/jpeg" },
              { src: track.coverUrl, sizes: "512x512", type: "image/jpeg" },
            ]
          : [],
      });
    } catch {
      // ignore metadata assignment failures
    }
  }

  private setupAudioListeners(audioEl: HTMLAudioElement) {
    audioEl.addEventListener("timeupdate", () => {
      if (this.isResetting || audioEl !== this.audio) return;
      if (!this.currentTrackId) return;
      if (usePlayerStore.getState().status === "loading") return;
      if (Number.isNaN(audioEl.currentTime)) return;

      const posMs = Math.round(audioEl.currentTime * 1000);
      usePlayerStore.getState().setPosition(posMs);
      this.scheduleTransition();
      if (
        this.recoveryHoldUntilMs !== null &&
        posMs >= this.recoveryHoldUntilMs
      ) {
        this.recoveryHoldUntilMs = null;
        this.recoveryAttempts = 0;
      }
    });

    audioEl.addEventListener("durationchange", () => {
      if (this.isResetting || audioEl !== this.audio) return;
      if (!this.currentTrackId) return;
      if (Number.isNaN(audioEl.duration) || audioEl.duration <= 0) return;

      usePlayerStore
        .getState()
        .setDuration(Math.round(audioEl.duration * 1000));
      this.syncMediaSessionPosition();
    });

    for (const type of [
      "seeked",
      "ratechange",
      "play",
      "pause",
      "loadedmetadata",
    ]) {
      audioEl.addEventListener(type, () => {
        if (this.isResetting || audioEl !== this.audio) return;
        this.syncMediaSessionPosition();
      });
    }

    for (const type of ["seeked", "ratechange", "pause"]) {
      audioEl.addEventListener(type, () => {
        if (audioEl !== this.audio) return;
        this.clearTransition();
        this.scheduleTransition();
      });
    }

    audioEl.addEventListener("waiting", () => {
      if (this.isResetting || audioEl !== this.audio) return;
      log("yellow", "audio", "buffering (waiting)");
      this.stallStartTime = performance.now();
      if (this.waitingTimer) clearTimeout(this.waitingTimer);
      this.waitingTimer = setTimeout(() => {
        this.waitingTimer = null;
        // still stuck: a real stall, show it
        if (audioEl !== this.audio || audioEl.paused || audioEl.readyState >= 3)
          return;
        if (usePlayerStore.getState().status === "playing") {
          usePlayerStore.getState().setStatus("loading");
        }
      }, WAITING_GRACE_MS);
    });

    // resumed (or never really stalled): drop a pending "loading"
    for (const type of ["playing", "seeked", "canplay", "pause", "emptied"]) {
      audioEl.addEventListener(type, () => {
        if (audioEl !== this.audio || !this.waitingTimer) return;
        if (type === "seeked" && audioEl.readyState < 3) return; // seeked but still no data
        clearTimeout(this.waitingTimer);
        this.waitingTimer = null;
      });
    }

    audioEl.addEventListener("ended", () => {
      if (this.isResetting || audioEl !== this.audio) return;
      if (!this.currentTrackId) return;
      if (this.attachedTrackId !== this.currentTrackId) return;

      // Ensure the track truly finished playing (not an empty media load or teardown artefact)
      const duration = audioEl.duration;
      const currentTime = audioEl.currentTime;
      if (duration > 0 && currentTime >= Math.max(0, duration - 1.5)) {
        log("cyan", "audio", "ended — skipping to next");
        this.onEnded?.();
        const state = usePlayerStore.getState();
        state.dispatch({ type: "SKIP_NEXT", isAutoEnd: true });
      }
    });

    audioEl.addEventListener("playing", () => {
      if (this.isResetting || audioEl !== this.audio) return;
      log("green", "audio", "playing");
      if (this.recoveryHoldUntilMs === null) this.recoveryAttempts = 0;
      this.applyPlaybackRateAndPitch();

      if (this.stallStartTime !== null) {
        const stallDurationMs = Math.round(
          performance.now() - this.stallStartTime,
        );
        if (stallDurationMs > 400) {
          telemetry.trackPlaybackHealth("STALL_BUFFERING", {
            trackId: this.currentTrackId || undefined,
            stallDurationMs,
          });
        }
        this.stallStartTime = null;
      }

      if (!this.currentTrackId || audioEl.paused) return;
      const currentStatus = usePlayerStore.getState().status;
      if (currentStatus !== "paused") {
        usePlayerStore.getState().setStatus("playing");
      }
    });

    audioEl.addEventListener("pause", () => {
      if (this.isResetting || audioEl !== this.audio) return;
      log("cyan", "audio", "paused");
      const st = usePlayerStore.getState().status;
      if (st === "playing") {
        usePlayerStore.getState().setStatus("paused");
      }
    });

    audioEl.addEventListener("error", () => {
      if (this.isResetting || audioEl !== this.audio) return;
      if (
        !this.currentTrackId ||
        !audioEl.src ||
        audioEl.src === window.location.href
      )
        return;
      // the previous track's source is still attached while the next one loads
      if (this.attachedTrackId !== this.currentTrackId) return;

      const message = audioEl.error?.message || "Audio playback error";
      const code = audioEl.error?.code;
      console.error(
        "[AudioElementError]",
        this.currentTrackId,
        code,
        message,
        audioEl.src,
      );
      log("red", "audio", `error (code ${code}): ${message}`);

      const isDecode =
        code ===
          (typeof MediaError !== "undefined"
            ? MediaError.MEDIA_ERR_DECODE
            : 3) ||
        code ===
          (typeof MediaError !== "undefined"
            ? MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
            : 4);

      if (isDecode) {
        telemetry.trackPlaybackHealth("MEDIA_DECODE_ERROR", {
          trackId: this.currentTrackId || undefined,
          errorMessage: message,
          details: { mediaErrorCode: code },
        });
      }

      if (this.attachedFromLiner) {
        this.attachedFromLiner = false;
        markLinerStreamFailed(`media error ${code}`);
      }

      if (this.activeBlobUrl) {
        URL.revokeObjectURL(this.activeBlobUrl);
        this.activeBlobUrl = null;
        void linerDb.deleteAudio(this.currentTrackId);
        audioCache.deleteAudio(this.currentTrackId);
      }

      const store = usePlayerStore.getState();
      const currentTrack = store.currentTrack;
      const posMs =
        Number.isFinite(audioEl.currentTime) && audioEl.currentTime > 0
          ? Math.round(audioEl.currentTime * 1000)
          : store.positionMs;

      if (
        currentTrack &&
        currentTrack.id === this.currentTrackId &&
        this.recoveryAttempts < 1
      ) {
        this.recoveryAttempts++;
        this.recoveryHoldUntilMs = posMs + RECOVERY_HOLD_MS;
        log(
          "yellow",
          "playback",
          `audio error encountered — recovering via cache/stream at ${posMs}ms`,
        );
        void this.loadAndPlay(currentTrack, posMs, true);
        return;
      }

      usePlayerStore.getState().setStatus("error", message);
      this.onError?.({ trackId: this.currentTrackId, message });
    });
  }

  public getCurrentTrackId(): string | null {
    return this.currentTrackId;
  }

  public hasLoadedSourceFor(trackId: string): boolean {
    const isExpired =
      this.currentSessionExpiresAt !== null &&
      Date.now() >= this.currentSessionExpiresAt - 15_000;
    return (
      this.currentTrackId === trackId &&
      this.attachedTrackId === trackId &&
      Boolean(this.audio.currentSrc || this.audio.src) &&
      this.audio.src !== window.location.href &&
      !this.audio.error &&
      !isExpired
    );
  }

  public applyPlaybackRateAndPitch(
    rate?: number,
    preservesPitch?: boolean,
  ): void {
    if (!this.audio) return;
    const store = usePlayerStore.getState();
    const targetRate = rate ?? store.playbackRate ?? 1;
    const targetPreserves =
      preservesPitch ??
      (store.isPitchLinked !== undefined ? !store.isPitchLinked : true);

    try {
      this.audio.playbackRate = targetRate;
      this.audio.defaultPlaybackRate = targetRate;
      this.audio.preservesPitch = targetPreserves;
      (this.audio as any).mozPreservesPitch = targetPreserves;
      (this.audio as any).webkitPreservesPitch = targetPreserves;
    } catch {
      // Audio element not initialized or properties unsupported
    }

    try {
      const isPitchLinked = store.isPitchLinked ?? true;
      const pitchSemitones = store.pitchSemitones ?? 0;
      const isReverbEnabled = store.isReverbEnabled ?? false;
      const reverbLevel = store.reverbLevel ?? 0.35;
      const isEqEnabled = store.isEqEnabled ?? false;
      const eqGains = store.eqGains ?? FLAT_EQ;
      const needsEffects =
        isReverbEnabled ||
        isEqActive(isEqEnabled, eqGains) ||
        (!isPitchLinked && Math.abs(pitchSemitones) >= 0.05);
      if (!needsEffects && !pitchShifter.isAttached()) return;
      pitchShifter.attach(this.audio);
      pitchShifter.update({
        pitchSemitones,
        isPitchLinked,
        isReverbEnabled,
        reverbLevel,
        isEqEnabled,
        eqGains,
      });
    } catch (err) {
      console.error("[PlayerRuntime] applyPlaybackRateAndPitch error:", err);
    }
  }

  private cancelFade(): void {
    this.stopFade?.();
    this.stopFade = null;
  }

  private fadeVolume(
    targetVolume: number,
    durationMs: number = 180,
    onComplete?: () => void,
  ): void {
    this.cancelFade();
    this.stopFade = rampVolume(this.audio, targetVolume, durationMs, () => {
      this.stopFade = null;
      onComplete?.();
    });
  }

  private clearTransition(): void {
    if (this.transitionTimer) clearTimeout(this.transitionTimer);
    this.transitionTimer = null;
  }

  private clearStandby(): void {
    this.standbyEpoch += 1;
    this.clearTransition();
    if (this.standbySlot) releaseStandbySource(this.standbySlot.source);
    this.standbySlot = null;
  }

  private isStandbyReadyFor(trackId: string): boolean {
    return (
      this.standbySlot?.trackId === trackId && this.standby.readyState >= 3
    );
  }

  private async prepareStandby(track: Track): Promise<void> {
    if (this.finishOutgoing) {
      this.pendingStandby = track;
      return;
    }
    if (
      track.id === this.currentTrackId ||
      track.id === this.standbySlot?.trackId
    )
      return;
    this.clearStandby();
    const epoch = this.standbyEpoch;
    const source = await resolveStandbySource(track);
    if (!source) return;
    if (
      epoch !== this.standbyEpoch ||
      this.finishOutgoing ||
      track.id === this.currentTrackId
    ) {
      releaseStandbySource(source);
      return;
    }
    this.standby.volume = 0;
    this.standby.src = source.url;
    this.standby.load();
    this.standbySlot = { trackId: track.id, source };
    log("cyan", "preload", `standby ready: "${track.title}"`);
  }

  private scheduleTransition(): void {
    if (this.transitionTimer || !this.standbySlot || this.audio.paused) return;
    const next = this.peekAutoNext?.();
    if (!next || next.id !== this.standbySlot.trackId) return;
    const remainingMs =
      ((this.audio.duration - this.audio.currentTime) * 1000) /
      (this.audio.playbackRate || 1);
    if (!Number.isFinite(remainingMs)) return;
    const { currentTrack, crossfadeSeconds } = usePlayerStore.getState();
    const { fadeMs, startInMs } = transitionTiming(
      remainingMs,
      transitionMs(currentTrack, next, crossfadeSeconds),
    );
    if (startInMs > TRANSITION_ARM_WINDOW_MS) return;
    this.transitionTimer = setTimeout(
      () => {
        this.transitionTimer = null;
        this.startTransition(next, fadeMs);
      },
      Math.max(0, startInMs),
    );
  }

  private startTransition(next: Track, fadeMs: number): void {
    if (this.audio.paused || !this.isStandbyReadyFor(next.id)) return;
    if (this.peekAutoNext?.()?.id !== next.id) return;
    log("cyan", "audio", "near the end — handing off to the next track");
    this.onEnded?.();
    this.handOff(next, fadeMs);
    this.handoffTrackId = next.id;
    usePlayerStore.getState().dispatch({ type: "SKIP_NEXT", isAutoEnd: true });
  }

  private handOff(track: Track, fadeMs: number): void {
    const source = this.standbySlot?.source ?? null;
    this.standbySlot = null;
    this.loadEpoch += 1;
    this.loadAbortController?.abort();
    this.loadAbortController = null;
    this.retireActive(fadeMs || GAPLESS_HEAD_START_MS);
    const blob = source?.blobUrl ?? null;
    this.activeBlobUrl = blob;
    this.releaseActiveStream = source?.release ?? null;
    this.currentTrackId = track.id;
    this.attachedTrackId = track.id;
    this.recoveryAttempts = 0;
    this.recoveryHoldUntilMs = null;
    this.audio.volume = fadeMs ? 0 : usePlayerStore.getState().volume;
    this.applyPlaybackRateAndPitch();
    const epoch = this.loadEpoch;
    const playStartedAt = performance.now();
    this.audio.play().then(
      () => {
        logNowPlaying(
          track,
          Boolean(blob),
          Math.round(performance.now() - playStartedAt),
        );
        if (epoch !== this.loadEpoch || !fadeMs) return;
        this.fadeVolume(usePlayerStore.getState().volume, fadeMs);
      },
      () => {
        if (epoch !== this.loadEpoch) return;
        this.handoffTrackId = null;
        void this.loadAndPlay(track);
      },
    );
    log(
      "green",
      "playback",
      `${fadeMs ? `crossfade ${fadeMs}ms` : "gapless"} into "${track.title}"`,
    );
  }

  private retireActive(fadeMs: number): void {
    this.finishOutgoing?.();
    this.clearStandby();
    this.cancelFade();
    const old = this.audio;
    const blob = this.activeBlobUrl;
    const release = this.releaseActiveStream;
    this.activeBlobUrl = null;
    this.releaseActiveStream = null;
    this.attachedTrackId = null;
    this.attachedFromLiner = false;
    this.currentSessionExpiresAt = null;
    this.audio = this.standby;
    this.standby = old;
    markActiveAudio(this.audio, old);

    let stopRamp = () => {};
    const finish = () => {
      stopRamp();
      this.finishOutgoing = null;
      old.pause();
      if (blob) URL.revokeObjectURL(blob);
      release?.();
      const pending = this.pendingStandby ?? this.peekAutoNext?.() ?? null;
      this.pendingStandby = null;
      if (pending) void this.prepareStandby(pending);
    };
    this.finishOutgoing = finish;
    stopRamp = rampVolume(old, 0, fadeMs, finish);
  }

  private releaseStream() {
    this.releaseActiveStream?.();
    this.releaseActiveStream = null;
  }

  private watchFullSource(trackId: string, stream: PlaybackStream) {
    const { completed, needsFullSource } = stream;
    if (!completed || !needsFullSource) return;
    void completed
      .then((blob) => {
        if (this.currentTrackId !== trackId || this.audio.src !== stream.url)
          return;
        if (needsFullSource()) this.swapToFullSource(blob);
      })
      .catch(() => undefined);
  }

  private swapToFullSource(blob: Blob) {
    const position = this.audio.currentTime;
    const wasPlaying = !this.audio.paused;
    const url = URL.createObjectURL(blob);
    this.isResetting = true;
    this.releaseStream();
    if (this.activeBlobUrl) URL.revokeObjectURL(this.activeBlobUrl);
    this.activeBlobUrl = url;
    this.audio.src = url;
    this.attachedFromLiner = false;
    this.applyPlaybackRateAndPitch();
    const settle = () => {
      this.isResetting = false;
    };
    this.audio.addEventListener(
      "loadedmetadata",
      () => {
        this.audio.currentTime = position;
        if (wasPlaying) void this.audio.play().then(settle, settle);
        else settle();
      },
      { once: true },
    );
    log("cyan", "playback", "switched to the fully downloaded source");
  }

  private safeResetAudioElement() {
    this.isResetting = true;
    this.currentSessionExpiresAt = null;
    try {
      this.cancelFade();
      this.audio.pause();
      this.releaseStream();
      if (this.activeBlobUrl) {
        URL.revokeObjectURL(this.activeBlobUrl);
        this.activeBlobUrl = null;
      }
      this.audio.removeAttribute("src");
      this.audio.load();
      this.attachedTrackId = null;
    } catch {
    } finally {
      this.isResetting = false;
    }
  }

  // between tracks: silence the old source but keep it attached until the next one
  // is ready. Emptying the element here made Chromium drop the system media session
  // during every skip, so Windows controls / FluentFlyout lost Liner after a track change.
  private pauseForTransition() {
    this.isResetting = true;
    this.currentSessionExpiresAt = null;
    try {
      this.cancelFade();
      this.audio.pause();
    } catch {
    } finally {
      this.isResetting = false;
    }
  }

  private attachSource(url: string, isBlob: boolean, trackId: string) {
    const previousBlob = this.activeBlobUrl;
    this.audio.src = url;
    this.activeBlobUrl = isBlob ? url : null;
    this.attachedTrackId = trackId;
    this.attachedFromLiner = false;
    if (previousBlob && previousBlob !== url) URL.revokeObjectURL(previousBlob);
  }

  public cancelPendingLoad(): void {
    this.loadEpoch += 1;
    this.loadAbortController?.abort();
    this.loadAbortController = null;
    this.backgroundCacheAbortController?.abort();
    this.backgroundCacheAbortController = null;
    this.currentTrackId = null;
    this.currentSessionExpiresAt = null;
    this.recoveryAttempts = 0;
    this.recoveryHoldUntilMs = null;
    this.finishOutgoing?.();
    this.clearTransition();
    this.safeResetAudioElement();
    usePlayerStore.getState().setStatus("paused");
    log("cyan", "playback", "pending load cancelled");
  }

  public async preloadTrack(track: Track): Promise<void> {
    const ticket = ++this.preloadTicket;
    await this.cacheAhead(track);
    if (ticket !== this.preloadTicket) return;
    await this.prepareStandby(track);
  }

  private async cacheAhead(track: Track): Promise<void> {
    if (isLocalTrackId(track.id) || isSavedTrack(track.id)) return;
    if (this.currentTrackId === track.id) return;
    if (this.preloadingTrackId === track.id)
      return this.preloadingPromise ?? undefined;

    const cached = await linerDb.getAudio(track.id);
    if (cached) return;

    this.preloadAbortController?.abort();
    const controller = new AbortController();
    this.preloadAbortController = controller;
    this.preloadingTrackId = track.id;

    const generation = audioCache.currentGeneration();
    const promise = (async () => {
      try {
        const stream = await resolvePlaybackStream(track, controller.signal);
        if (controller.signal.aborted) return;

        const blob = await this.downloadAudioBlob(stream, controller.signal);
        if (!blob || controller.signal.aborted) return;
        if (
          !(await audioCache.saveAudioBlob(
            track.id,
            blob,
            blob.type,
            generation,
          ))
        )
          return;
        await linerDb.putTrack(track);
        log(
          "green",
          "preload",
          `preloaded audio: "${track.title}" (${Math.round(blob.size / 1024)} KB)`,
        );
      } catch {
      } finally {
        if (this.preloadingTrackId === track.id) {
          this.preloadingTrackId = null;
          this.preloadingPromise = null;
          this.preloadAbortController = null;
        }
      }
    })();

    this.preloadingPromise = promise;
    await promise;
  }

  private pendingStartPositionMs = 0;

  public stop(): void {
    this.cancelPendingLoad();
    this.updateMediaSessionMetadata(null);
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.playbackState = "none";
      } catch {}
    }
  }

  public setPendingSeek(positionMs: number): void {
    this.pendingStartPositionMs = positionMs;
    usePlayerStore.getState().setPosition(positionMs);
    if (this.audio.src && this.audio.src !== window.location.href) {
      try {
        if (this.audio.readyState >= 1) {
          this.audio.currentTime = positionMs / 1000;
        } else {
          this.audio.addEventListener(
            "loadedmetadata",
            () => {
              try {
                this.audio.currentTime = positionMs / 1000;
              } catch {}
            },
            { once: true },
          );
        }
      } catch {}
    }
  }

  public async loadAndPlay(
    track: Track,
    startPositionMs: number = 0,
    bypassCache: boolean = false,
  ) {
    if (
      this.handoffTrackId === track.id &&
      !bypassCache &&
      startPositionMs === 0
    ) {
      this.handoffTrackId = null;
      const store = usePlayerStore.getState();
      if (!store.keepSpeedAcrossTracks) store.resetSpeedAndPitch();
      this.updateMediaSessionMetadata(track);
      store.setStatus("playing");
      return;
    }
    this.handoffTrackId = null;
    this.cancelFade();
    this.pendingStartPositionMs = startPositionMs;
    const epoch = ++this.loadEpoch;

    if (this.currentTrackId !== track.id) {
      this.recoveryAttempts = 0;
      this.recoveryHoldUntilMs = null;
    }

    if (this.preloadingTrackId === track.id && this.preloadingPromise) {
      await this.preloadingPromise;
    } else if (this.preloadingTrackId && this.preloadingTrackId !== track.id) {
      this.preloadAbortController?.abort();
      this.preloadAbortController = null;
      this.preloadingTrackId = null;
      this.preloadingPromise = null;
    }

    this.loadAbortController?.abort();
    const controller = new AbortController();
    this.loadAbortController = controller;

    this.backgroundCacheAbortController?.abort();
    const bgCacheController = new AbortController();
    this.backgroundCacheAbortController = bgCacheController;

    const store = usePlayerStore.getState();
    if (!store.keepSpeedAcrossTracks && this.currentTrackId !== track.id) {
      store.resetSpeedAndPitch();
    }

    if (
      !bypassCache &&
      startPositionMs === 0 &&
      this.isStandbyReadyFor(track.id)
    ) {
      this.updateMediaSessionMetadata(track);
      this.handOff(track, this.audio.paused ? 0 : SKIP_FADE_MS);
      return;
    }

    this.currentTrackId = track.id;
    this.loadStartTime = performance.now();
    this.updateMediaSessionMetadata(track);

    store.setStatus("loading", null);
    store.setPosition(startPositionMs > 0 ? startPositionMs : 0);

    if (this.audio.paused) this.pauseForTransition();
    else this.retireActive(SKIP_FADE_MS);

    try {
      const cachedAudio =
        bypassCache || isSavedTrack(track.id)
          ? null
          : await linerDb.getAudio(track.id);
      if (epoch !== this.loadEpoch || controller.signal.aborted) {
        return;
      }

      const isValidCachedBlob =
        Boolean(cachedAudio?.blob) &&
        cachedAudio!.blob.size > 0 &&
        (!cachedAudio!.blob.type ||
          cachedAudio!.blob.type.startsWith("audio/"));

      if (cachedAudio && !isValidCachedBlob) {
        void linerDb.deleteAudio(track.id);
        audioCache.deleteAudio(track.id);
      }

      if (cachedAudio && isValidCachedBlob) {
        this.currentSessionExpiresAt = null;
        void linerDb.putTrack(track);
        const blobUrl = URL.createObjectURL(cachedAudio.blob);
        this.attachSource(blobUrl, true, track.id);
        this.audio.volume = 0;
        this.audio.load();
        this.applyPlaybackRateAndPitch();

        const targetPosition =
          this.pendingStartPositionMs > 0
            ? this.pendingStartPositionMs
            : startPositionMs;
        this.seekWhenReady(epoch, targetPosition);
        log(
          "cyan",
          "playback",
          `audio cache hit for "${track.title}" (${Math.round(cachedAudio.byteSize / 1024)} KB)`,
        );

        if (this.audio.readyState < 3) {
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, 3000);
            const onCanPlay = () => {
              clearTimeout(timeout);
              this.audio.removeEventListener("canplay", onCanPlay);
              this.audio.removeEventListener("error", onCanPlay);
              resolve();
            };
            this.audio.addEventListener("canplay", onCanPlay, { once: true });
            this.audio.addEventListener("error", onCanPlay, { once: true });
          });
        }

        if (epoch !== this.loadEpoch || controller.signal.aborted) return;

        const playPromise = this.audio.play();
        this.activePlayPromise = playPromise;
        await playPromise;

        const audioStartLatencyMs = Math.round(
          performance.now() - this.loadStartTime,
        );

        if (epoch === this.loadEpoch) {
          usePlayerStore.getState().setStatus("playing");
          this.fadeVolume(usePlayerStore.getState().volume, 180);
        }
        logNowPlaying(track, true, audioStartLatencyMs);
        return;
      }

      const stream = await resolvePlaybackStream(track, controller.signal, {
        progressive: true,
      });
      this.ttfbMs = Math.round(performance.now() - this.loadStartTime);

      if (epoch !== this.loadEpoch || controller.signal.aborted) {
        stream.release?.();
        log(
          "yellow",
          "playback",
          `superseded before stream ready (${track.title})`,
        );
        return;
      }

      const streamCodec = stream.codec;
      const streamBitrate = stream.bitrate;
      this.currentSessionExpiresAt = stream.expiresAtMs;
      log("cyan", "playback", `resolved stream for ${track.title}`);
      this.releaseStream();
      const url = stream.blob ? URL.createObjectURL(stream.blob) : stream.url;
      this.attachSource(url, Boolean(stream.blob), track.id);
      this.attachedFromLiner = Boolean(stream.fromLiner);
      this.releaseActiveStream = stream.release ?? null;
      this.watchFullSource(track.id, stream);
      this.audio.volume = 0;
      this.audio.load();
      this.applyPlaybackRateAndPitch();

      const targetPosition =
        this.pendingStartPositionMs > 0
          ? this.pendingStartPositionMs
          : startPositionMs;
      this.seekWhenReady(epoch, targetPosition);
      log(
        "green",
        "playback",
        `stream attached: ${streamCodec} ${streamBitrate} bps (${track.title})`,
      );

      if (this.audio.readyState < 3) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 3000);
          const onCanPlay = () => {
            clearTimeout(timeout);
            this.audio.removeEventListener("canplay", onCanPlay);
            this.audio.removeEventListener("error", onCanPlay);
            resolve();
          };
          this.audio.addEventListener("canplay", onCanPlay, { once: true });
          this.audio.addEventListener("error", onCanPlay, { once: true });
        });
      }

      if (epoch !== this.loadEpoch || controller.signal.aborted) return;

      const playPromise = this.audio.play();
      this.activePlayPromise = playPromise;
      await playPromise;

      const audioStartLatencyMs = Math.round(
        performance.now() - this.loadStartTime,
      );

      if (epoch === this.loadEpoch) {
        usePlayerStore.getState().setStatus("playing");
        this.fadeVolume(usePlayerStore.getState().volume, 180);
        this.cacheAudioInBackground(track, stream, bgCacheController.signal);
      }
      logNowPlaying(track, false, audioStartLatencyMs);

      telemetry.trackPlaybackHealth("INIT_LATENCY", {
        trackId: track.id,
        codec: streamCodec,
        bitrate: streamBitrate,
        timeToFirstByteMs: this.ttfbMs,
        audioStartLatencyMs,
      });
    } catch (error) {
      if (epoch !== this.loadEpoch || controller.signal.aborted) {
        return;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      if (error instanceof DOMException && error.name === "NotAllowedError") {
        log(
          "yellow",
          "playback",
          "autoplay blocked — waiting for user gesture",
        );
        usePlayerStore.getState().setStatus("paused");
        return;
      }

      if (
        isBotCheckError(error) &&
        !isYoutubeSignedIn() &&
        !isYoutubeSignInDeclined() &&
        prefersSignInPrompt()
      ) {
        log("yellow", "playback", "youtube sign-in required, pausing");
        usePlayerStore.getState().setStatus("paused");
        requestYoutubeSignIn();
        return;
      }

      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Playback failed to start.";
      console.error("[LoadAndPlayError]", track.id, error);
      log("red", "playback", `failed: ${message}`);
      usePlayerStore.getState().setStatus("error", message);

      telemetry
        .reportError(error, {
          action: "playback_failed",
          trackId: track.id,
          title: track.title,
        })
        .catch(() => {});

      this.onError?.({ trackId: track.id, message });
    } finally {
      if (epoch === this.loadEpoch) {
        this.activePlayPromise = null;
      }
    }
  }

  private seekWhenReady(epoch: number, positionMs: number) {
    if (positionMs <= 0) return;
    const apply = () => {
      if (epoch !== this.loadEpoch) return;
      try {
        this.audio.currentTime = positionMs / 1000;
      } catch {
        // Media not seekable yet — ignore
      }
    };
    if (this.audio.readyState >= 1) {
      apply();
    } else {
      this.audio.addEventListener("loadedmetadata", apply, { once: true });
    }
  }

  public pause() {
    const epoch = ++this.loadEpoch;
    this.loadAbortController?.abort();
    this.loadAbortController = null;
    this.finishOutgoing?.();
    this.clearTransition();
    usePlayerStore.getState().setStatus("paused");
    log("cyan", "audio", "pause requested (fading out)");

    this.fadeVolume(0, 180, () => {
      if (epoch !== this.loadEpoch) return;
      this.audio.pause();
    });
  }

  public resume() {
    const epoch = ++this.loadEpoch;
    this.loadAbortController?.abort();
    this.loadAbortController = null;

    const targetVolume = usePlayerStore.getState().volume;
    usePlayerStore.getState().setStatus("playing");
    pitchShifter.resumeContext();
    this.applyPlaybackRateAndPitch();
    log("cyan", "audio", "resume requested (fading in)");

    const currentTrack = usePlayerStore.getState().currentTrack;
    const isExpired =
      this.currentSessionExpiresAt !== null &&
      Date.now() >= this.currentSessionExpiresAt - 15_000;
    const hasMediaError = Boolean(this.audio.error);
    const hasValidSource =
      Boolean(this.audio.src) &&
      this.audio.src !== window.location.href &&
      !isExpired &&
      !hasMediaError;

    if (!hasValidSource && currentTrack) {
      void this.loadAndPlay(currentTrack, usePlayerStore.getState().positionMs);
      return;
    }

    if (this.audio.paused) {
      this.audio.volume = 0;
      const playPromise = this.audio.play();
      this.activePlayPromise = playPromise;
      playPromise
        .then(() => {
          if (epoch !== this.loadEpoch) return;
          this.fadeVolume(targetVolume, 180);
        })
        .catch((error) => {
          if (epoch !== this.loadEpoch) return;
          if (error.name === "NotAllowedError") {
            log("yellow", "audio", "play blocked — waiting for user gesture");
            usePlayerStore.getState().setStatus("paused");
          } else if (error.name !== "AbortError") {
            log("red", "audio", `play failed: ${String(error)}`);
            if (currentTrack && this.recoveryAttempts < 1) {
              this.recoveryAttempts++;
              log(
                "yellow",
                "playback",
                "resume failed — attempting cache/stream recovery",
              );
              void this.loadAndPlay(
                currentTrack,
                usePlayerStore.getState().positionMs,
                true,
              );
              return;
            }
            usePlayerStore.getState().setStatus("paused");
          }
        })
        .finally(() => {
          if (epoch === this.loadEpoch) this.activePlayPromise = null;
        });
    } else {
      this.fadeVolume(targetVolume, 180);
    }
  }

  public seek(positionMs: number) {
    if (!this.audio.src || this.audio.src === window.location.href) return;
    try {
      if (this.audio.readyState >= 1) {
        this.audio.currentTime = positionMs / 1000;
      } else {
        this.audio.addEventListener(
          "loadedmetadata",
          () => {
            try {
              this.audio.currentTime = positionMs / 1000;
            } catch {}
          },
          { once: true },
        );
      }
    } catch {
      // Ignore seek error if media not yet ready
    }
  }

  private async downloadAudioBlob(
    stream: PlaybackStream,
    signal: AbortSignal,
  ): Promise<Blob | null> {
    if (stream.blob) return stream.blob;
    if (stream.completed) return stream.completed;
    const startedAt = performance.now();
    let bytes: Uint8Array<ArrayBuffer> | null;
    try {
      bytes = await downloadAudioBytes(stream.url, {
        contentLength: stream.contentLength,
        signal,
      });
    } catch (error) {
      if (stream.fromLiner && !signal.aborted)
        markLinerStreamFailed(`download: ${String(error)}`);
      throw error;
    }
    if (!bytes || signal.aborted) return null;
    const mimeType = stream.mimeType || "audio/webm";
    if (!mimeType.startsWith("audio/") && !mimeType.startsWith("video/"))
      return null;
    if (!isStandaloneAudioFile(bytes.subarray(0, 16))) {
      log(
        "yellow",
        "download",
        `not caching: stream is not a standalone audio file`,
      );
      return null;
    }
    log(
      "cyan",
      "download",
      `${Math.round(bytes.byteLength / 1024)} KB in ${Math.round(performance.now() - startedAt)}ms (${stream.contentLength ? "chunked" : "single request"})`,
    );
    return new Blob([bytes], { type: mimeType });
  }

  private cacheAudioInBackground(
    track: Track,
    stream: PlaybackStream,
    signal: AbortSignal,
  ) {
    if (isLocalTrackId(track.id) || isSavedTrack(track.id)) return;
    if (track.durationMs && track.durationMs > 20 * 60 * 1000) return;
    const generation = audioCache.currentGeneration();
    void (async () => {
      try {
        const blob = await this.downloadAudioBlob(stream, signal);
        if (!blob || signal.aborted) return;
        if (
          !(await audioCache.saveAudioBlob(
            track.id,
            blob,
            blob.type,
            generation,
          ))
        )
          return;
        await linerDb.putTrack(track);
        log(
          "green",
          "playback",
          `background cached: ${track.title} (${Math.round(blob.size / 1024)} KB)`,
        );
      } catch {}
    })();
  }
}

export const playerRuntime =
  typeof window !== "undefined" ? new PlayerRuntime() : null;
