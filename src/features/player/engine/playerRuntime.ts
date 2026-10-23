import { usePlayerStore } from "../store/playerStore";
import { ApiError } from "@/shared/api";
import { log } from "@/shared/utils/logger";
import { telemetry } from "@/shared/telemetry";
import { linerDb, audioCache } from "@/shared/storage";
import { isStandaloneAudioFile } from "@/shared/storage/audioFormat";
import type { Track } from "@/shared/types";
import { pitchShifter } from "./pitchShifter";
import { resolvePlaybackStream, type PlaybackStream } from "./streamResolver";
import { downloadAudioBytes } from "@/shared/media/innertube";


// error recovery tuning (see the audio "error" handler)
const RECOVERY_HOLD_MS = 3000;
const WAITING_GRACE_MS = 300; // a buffering hiccup shorter than this never shows // must play this far past a recovery before it may retry again

export class PlayerRuntime {
  private decks: [HTMLAudioElement, HTMLAudioElement];
  private activeDeckIndex: 0 | 1 = 0;
  private activeBlobUrls: [string | null, string | null] = [null, null];
  private isTransitioning = false;
  private crossfadeAttemptedTrackId: string | null = null;
  private currentTrackId: string | null = null;
  private loadEpoch = 0;
  private loadAbortController: AbortController | null = null;
  private isResetting = false;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private stallStartTime: number | null = null;
  private loadStartTime = 0;
  private ttfbMs = 0;
  private activePlayPromise: Promise<void> | null = null;
  private attachedTrackId: string | null = null;
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
  public getUpcomingTrack?: () => Track | null;
  public onCrossfadeStart?: (nextTrack: Track) => void;
  public onCrossfadeComplete?: (nextTrack: Track) => void;


  public get audio(): HTMLAudioElement {
    return this.decks[this.activeDeckIndex];
  }

  public set audio(el: HTMLAudioElement) {
    this.decks[this.activeDeckIndex] = el;
  }

  private get activeBlobUrl(): string | null {
    return this.activeBlobUrls[this.activeDeckIndex];
  }

  private set activeBlobUrl(url: string | null) {
    this.activeBlobUrls[this.activeDeckIndex] = url;
  }

  public syncActiveDeckDom(): void {
    if (!this.decks || this.decks.length < 2) return;
    const active = this.decks[this.activeDeckIndex];
    const inactive = this.decks[1 - this.activeDeckIndex];
    if (active) {
      active.id = "liner-audio";
    }
    if (inactive) {
      inactive.id = "liner-audio-b";
    }
    if (typeof window !== "undefined") {
      const win = window as any;
      win.__liner_audio = active;
      win.__liner_audio_b = inactive;
      try {
        win.dispatchEvent(
          new CustomEvent("liner:active-audio-change", {
            detail: { audio: active },
          }),
        );
      } catch {}
    }
  }

  constructor() {
    const win = typeof window !== "undefined" ? (window as any) : null;
    let deckA = (win?.__liner_audio || (typeof document !== "undefined" && document.getElementById("liner-audio"))) as HTMLAudioElement | null;
    if (!deckA) {
      deckA = new Audio();
      deckA.id = "liner-audio";
      deckA.crossOrigin = "anonymous";
      deckA.preload = "auto";
      if (typeof document !== "undefined") {
        document.body.appendChild(deckA);
      }
    }
    let deckB = (win?.__liner_audio_b || (typeof document !== "undefined" && document.getElementById("liner-audio-b"))) as HTMLAudioElement | null;
    if (!deckB) {
      deckB = new Audio();
      deckB.id = "liner-audio-b";
      deckB.crossOrigin = "anonymous";
      deckB.preload = "auto";
      if (typeof document !== "undefined") {
        document.body.appendChild(deckB);
      }
    }
    if (win) {
      win.__liner_audio = deckA;
      win.__liner_audio_b = deckB;
    }
    this.decks = [deckA, deckB];
    this.syncActiveDeckDom();
    this.setupAudioListeners(deckA);
    this.setupAudioListeners(deckB);

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
        state.reverbLevel !== prevState.reverbLevel
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
      if (!this.audio.paused && usePlayerStore.getState().status === "playing") {
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
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

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
        const max = st.durationMs > 0 ? st.durationMs : Number.POSITIVE_INFINITY;
        const next = Math.min(max, Math.max(0, st.positionMs + deltaSeconds * 1000));
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
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
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
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
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
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
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
    const audioObj = audioEl as any;
    if (audioObj.__liner_listeners_attached) return;
    audioObj.__liner_listeners_attached = true;

    audioEl.addEventListener("timeupdate", () => {
      if (this.isResetting) return;
      if (audioEl !== this.audio) return;
      if (!this.currentTrackId) return;
      if (usePlayerStore.getState().status === "loading") return;
      if (Number.isNaN(audioEl.currentTime)) return;

      const posMs = Math.round(audioEl.currentTime * 1000);
      usePlayerStore.getState().setPosition(posMs);
      if (this.recoveryHoldUntilMs !== null && posMs >= this.recoveryHoldUntilMs) {
        this.recoveryHoldUntilMs = null;
        this.recoveryAttempts = 0;
      }
      this.checkCrossfadeTrigger(audioEl);
    });

    audioEl.addEventListener("durationchange", () => {
      if (this.isResetting) return;
      if (audioEl !== this.audio) return;
      if (!this.currentTrackId) return;
      if (Number.isNaN(audioEl.duration) || audioEl.duration <= 0 || !Number.isFinite(audioEl.duration)) return;

      const track = usePlayerStore.getState().currentTrack;
      // Do not overwrite accurate metadata duration with a partial streaming chunk duration
      if (track?.durationMs && track.durationMs > 15_000 && (audioEl.duration * 1000) < track.durationMs * 0.75) {
        return;
      }

      usePlayerStore.getState().setDuration(Math.round(audioEl.duration * 1000));
      this.syncMediaSessionPosition();
    });

    for (const type of ["seeked", "ratechange", "play", "pause", "loadedmetadata"]) {
      audioEl.addEventListener(type, () => {
        if (this.isResetting || audioEl !== this.audio) return;
        this.syncMediaSessionPosition();
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
        if (audioEl !== this.audio || audioEl.paused || audioEl.readyState >= 3) return;
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
      if (this.isResetting) return;
      if (audioEl !== this.audio) return;
      if (!this.currentTrackId) return;
      if (this.attachedTrackId !== this.currentTrackId) return;

      log("cyan", "audio", "track ended naturally — advancing to next");
      this.isTransitioning = false;
      this.onEnded?.();
      const state = usePlayerStore.getState();
      state.dispatch({ type: "SKIP_NEXT", isAutoEnd: true });
    });

    audioEl.addEventListener("playing", () => {
      if (this.isResetting) return;
      if (audioEl !== this.audio) return;
      log("green", "audio", "playing");
      if (this.recoveryHoldUntilMs === null) this.recoveryAttempts = 0;
      this.applyPlaybackRateAndPitch();

      if (this.stallStartTime !== null) {
        const stallDurationMs = Math.round(performance.now() - this.stallStartTime);
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
      if (this.isResetting) return;
      if (this.isTransitioning) return;
      if (audioEl !== this.audio) return;
      log("cyan", "audio", "paused");
      const st = usePlayerStore.getState().status;
      if (st === "playing") {
        usePlayerStore.getState().setStatus("paused");
      }
    });

    audioEl.addEventListener("error", () => {
      if (this.isResetting) return;
      if (this.isTransitioning && audioEl !== this.audio) {
        this.isTransitioning = false;
        return;
      }
      if (audioEl !== this.audio) return;
      if (!this.currentTrackId || !audioEl.src || audioEl.src === window.location.href) return;
      // the previous track's source is still attached while the next one loads
      if (this.attachedTrackId !== this.currentTrackId) return;

      const message = audioEl.error?.message || "Audio playback error";
      const code = audioEl.error?.code;
      console.error("[AudioElementError]", this.currentTrackId, code, message, audioEl.src);
      log("red", "audio", `error (code ${code}): ${message}`);

      const isDecode =
        code === (typeof MediaError !== "undefined" ? MediaError.MEDIA_ERR_DECODE : 3) ||
        code === (typeof MediaError !== "undefined" ? MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED : 4);

      if (isDecode) {
        telemetry.trackPlaybackHealth("MEDIA_DECODE_ERROR", {
          trackId: this.currentTrackId || undefined,
          errorMessage: message,
          details: { mediaErrorCode: code },
        });
      }

      if (this.activeBlobUrl) {
        URL.revokeObjectURL(this.activeBlobUrl);
        this.activeBlobUrl = null;
        void linerDb.deleteAudio(this.currentTrackId);
        audioCache.deleteAudio(this.currentTrackId);
      }

      const store = usePlayerStore.getState();
      const currentTrack = store.currentTrack;
      const posMs = Number.isFinite(audioEl.currentTime) && audioEl.currentTime > 0
        ? Math.round(audioEl.currentTime * 1000)
        : store.positionMs;

      if (
        currentTrack &&
        currentTrack.id === this.currentTrackId &&
        this.recoveryAttempts < 1
      ) {
        this.recoveryAttempts++;
        this.recoveryHoldUntilMs = posMs + RECOVERY_HOLD_MS;
        log("yellow", "playback", `audio error encountered — recovering via cache/stream at ${posMs}ms`);
        void this.loadAndPlay(currentTrack, posMs, true);
        return;
      }

      usePlayerStore.getState().setStatus("error", message);
      this.onError?.({ trackId: this.currentTrackId, message });
    });
  }

  private checkCrossfadeTrigger(audioEl: HTMLAudioElement): void {
    const store = usePlayerStore.getState();
    if (!store.crossfadeEnabled) return;
    if (this.isTransitioning) return;
    if (store.status !== "playing") return;
    if (store.repeat === "one") return;

    const currentTime = audioEl.currentTime;
    if (!currentTime || currentTime <= 0) return;

    // Use authoritative total duration from metadata or media element
    const currentTrack = store.currentTrack;
    const metadataDurationSec =
      currentTrack?.durationMs && currentTrack.durationMs > 0
        ? currentTrack.durationMs / 1000
        : 0;
    const mediaDurationSec =
      audioEl.duration &&
      !Number.isNaN(audioEl.duration) &&
      Number.isFinite(audioEl.duration) &&
      audioEl.duration > 0
        ? audioEl.duration
        : 0;

    const duration = Math.max(metadataDurationSec, mediaDurationSec);
    if (!duration || duration < 15) return;

    // Never trigger crossfade during the first 70% of a song!
    // Outro crossfade only happens in the final 30% of the track.
    if (currentTime < duration * 0.7) return;

    const configuredDuration = store.crossfadeDuration || 5;
    const remainingSec = duration - currentTime;

    // Trigger crossfade in the outro when remainingSec is within configured range (and >= 1.0s)
    if (remainingSec <= configuredDuration && remainingSec >= 1.0) {
      const nextTrack = this.getUpcomingTrack?.();
      if (!nextTrack || nextTrack.id === this.currentTrackId) return;
      if (this.crossfadeAttemptedTrackId === nextTrack.id) return;

      this.crossfadeAttemptedTrackId = nextTrack.id;
      const effectiveDuration = Math.min(configuredDuration, Math.max(1, remainingSec));
      log(
        "cyan",
        "crossfade",
        `Crossfade starting to "${nextTrack.title}" (${remainingSec.toFixed(1)}s remaining, duration: ${effectiveDuration.toFixed(1)}s)`,
      );
      void this.startCrossfade(nextTrack, effectiveDuration);
    }
  }

  public async startCrossfade(
    nextTrack: Track,
    durationSec: number,
  ): Promise<void> {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    const currentEpoch = ++this.loadEpoch;

    const outgoingIndex = this.activeDeckIndex;
    const outgoingDeck = this.decks[outgoingIndex];
    const incomingIndex = (1 - outgoingIndex) as 0 | 1;
    const incomingDeck = this.decks[incomingIndex];

    try {
      // 1. Resolve stream or cache for next track
      const cached = await linerDb.getAudio(nextTrack.id);
      if (currentEpoch !== this.loadEpoch) {
        this.isTransitioning = false;
        return;
      }

      let streamUrl: string;
      if (cached?.blob && cached.blob.size > 0) {
        const blobUrl = URL.createObjectURL(cached.blob);
        this.activeBlobUrls[incomingIndex] = blobUrl;
        streamUrl = blobUrl;
      } else {
        const stream = await resolvePlaybackStream(nextTrack);
        if (currentEpoch !== this.loadEpoch) {
          this.isTransitioning = false;
          return;
        }
        streamUrl = stream.blob ? URL.createObjectURL(stream.blob) : stream.url;
        if (stream.blob) this.activeBlobUrls[incomingIndex] = streamUrl;
      }

      // Check if outgoing deck paused or ended during async stream resolution
      if (outgoingDeck.paused || outgoingDeck.ended) {
        this.isTransitioning = false;
        if (outgoingDeck.ended) {
          usePlayerStore.getState().dispatch({ type: "SKIP_NEXT", isAutoEnd: true });
        }
        return;
      }

      const store = usePlayerStore.getState();
      const userRate = store.playbackRate ?? 1;

      incomingDeck.src = streamUrl;
      incomingDeck.volume = 0;
      incomingDeck.currentTime = 0;
      incomingDeck.load();

      try {
        incomingDeck.playbackRate = userRate;
        incomingDeck.defaultPlaybackRate = userRate;
        incomingDeck.preservesPitch = !store.isPitchLinked;
      } catch {}

      if (incomingDeck.readyState < 3) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            if (incomingDeck.readyState >= 2) {
              resolve();
            } else {
              reject(new Error("Incoming deck buffering timeout"));
            }
          }, 3000);
          const onReady = () => {
            clearTimeout(timeout);
            incomingDeck.removeEventListener("canplay", onReady);
            incomingDeck.removeEventListener("error", onError);
            resolve();
          };
          const onError = () => {
            clearTimeout(timeout);
            incomingDeck.removeEventListener("canplay", onReady);
            incomingDeck.removeEventListener("error", onError);
            reject(new Error("Incoming deck media error"));
          };
          incomingDeck.addEventListener("canplay", onReady, { once: true });
          incomingDeck.addEventListener("error", onError, { once: true });
        });
      }

      if (currentEpoch !== this.loadEpoch) {
        this.isTransitioning = false;
        this.resetDeck(incomingIndex);
        return;
      }

      await incomingDeck.play();

      const upcomingTrack = this.getUpcomingTrack ? this.getUpcomingTrack() : nextTrack;
      if (currentEpoch !== this.loadEpoch || upcomingTrack?.id !== nextTrack.id) {
        this.isTransitioning = false;
        this.resetDeck(incomingIndex);
        return;
      }

      // Immediately transfer active deck and track ownership to the incoming track!
      // This ensures:
      // 1. timeupdate & position tracking track the incoming song (starting at 0:00).
      // 2. Outgoing deck's "ended" event (when it finishes its outro) is ignored because audioEl !== this.audio.
      // 3. User controls (pause, seek, volume) target the incoming deck.
      this.activeDeckIndex = incomingIndex;
      this.currentTrackId = nextTrack.id;
      this.attachedTrackId = nextTrack.id;
      this.crossfadeAttemptedTrackId = null;
      this.syncActiveDeckDom();

      this.applyPlaybackRateAndPitch();
      this.updateMediaSessionMetadata(nextTrack);
      this.onCrossfadeStart?.(nextTrack);

      const durationMs = Math.max(1000, durationSec * 1000);
      const startTime = performance.now();

      // Equal-power crossfade loop: smooth transition between decks
      await new Promise<void>((resolve) => {
        const tick = () => {
          if (currentEpoch !== this.loadEpoch) {
            resolve();
            return;
          }

          const elapsed = performance.now() - startTime;
          const progress = Math.min(1, elapsed / durationMs);
          const masterVol = usePlayerStore.getState().volume;

          const gainOut = Math.cos(progress * 0.5 * Math.PI);
          const gainIn = Math.sin(progress * 0.5 * Math.PI);

          if (!outgoingDeck.ended) {
            outgoingDeck.volume = Math.max(0, Math.min(1, masterVol * gainOut));
          }
          incomingDeck.volume = Math.max(0, Math.min(1, masterVol * gainIn));

          if (progress < 1 && !incomingDeck.paused) {
            setTimeout(tick, 16);
          } else {
            resolve();
          }
        };
        setTimeout(tick, 16);
      });

      if (currentEpoch !== this.loadEpoch) {
        this.isTransitioning = false;
        this.resetDeck(outgoingIndex);
        return;
      }

      // Finalize: stop outgoing deck and reset its source
      this.resetDeck(outgoingIndex);

      incomingDeck.volume = usePlayerStore.getState().volume;
      this.applyPlaybackRateAndPitch();

      this.isTransitioning = false;
      this.onCrossfadeComplete?.(nextTrack);
      log("green", "crossfade", `Crossfade complete: now playing "${nextTrack.title}"`);
    } catch (err) {
      log("yellow", "crossfade", `Crossfade interrupted or failed: ${err}`);
      this.isTransitioning = false;

      // Clean up incoming deck if failed
      try {
        this.resetDeck(incomingIndex);
      } catch {}

      // If outgoing deck already ended while resolving incoming track, skip to next immediately
      if (outgoingDeck.ended || outgoingDeck.currentTime >= Math.max(0, outgoingDeck.duration - 1.0)) {
        usePlayerStore.getState().dispatch({ type: "SKIP_NEXT", isAutoEnd: true });
      }
    }
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

  public applyPlaybackRateAndPitch(rate?: number, preservesPitch?: boolean): void {
    if (!this.audio) return;
    const store = usePlayerStore.getState();
    const targetRate = rate ?? store.playbackRate ?? 1;
    const targetPreserves =
      preservesPitch ?? (store.isPitchLinked !== undefined ? !store.isPitchLinked : true);

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
      const needsEffects = isReverbEnabled || (!isPitchLinked && Math.abs(pitchSemitones) >= 0.05);
      if (!needsEffects && !pitchShifter.isAttached()) return;
      pitchShifter.attach(this.audio);
      pitchShifter.update({
        pitchSemitones,
        isPitchLinked,
        isReverbEnabled,
        reverbLevel,
      });
    } catch (err) {
      console.error("[PlayerRuntime] applyPlaybackRateAndPitch error:", err);
    }
  }

  private cancelFade(): void {
    if (this.fadeTimer !== null) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  private fadeVolume(
    targetVolume: number,
    durationMs: number = 180,
    onComplete?: () => void,
  ): void {
    this.cancelFade();
    const startVolume = this.audio.volume;
    const diff = targetVolume - startVolume;
    if (Math.abs(diff) < 0.001 || durationMs <= 0) {
      this.audio.volume = Math.max(0, Math.min(1, targetVolume));
      onComplete?.();
      return;
    }

    const startTime = performance.now();

    const tick = () => {
      const now = performance.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 0.5 - 0.5 * Math.cos(progress * Math.PI);
      const current = startVolume + diff * eased;
      this.audio.volume = Math.max(0, Math.min(1, current));

      if (progress < 1) {
        // audio fade ticks independently of display vsync in background
        this.fadeTimer = setTimeout(tick, 16);
      } else {
        this.fadeTimer = null;
        this.audio.volume = Math.max(0, Math.min(1, targetVolume));
        onComplete?.();
      }
    };

    this.fadeTimer = setTimeout(tick, 16);
  }

  private resetDeck(index: 0 | 1): void {
    const deck = this.decks[index];
    deck.pause();
    if (this.activeBlobUrls[index]) {
      URL.revokeObjectURL(this.activeBlobUrls[index]!);
      this.activeBlobUrls[index] = null;
    }
    deck.removeAttribute("src");
    deck.load();
    deck.volume = usePlayerStore.getState().volume;
  }

  private safeResetAudioElement() {
    this.isResetting = true;
    this.isTransitioning = false;
    this.crossfadeAttemptedTrackId = null;
    this.currentSessionExpiresAt = null;
    try {
      this.cancelFade();
      for (let i = 0; i < 2; i++) {
        this.resetDeck(i as 0 | 1);
      }
      this.attachedTrackId = null;
      this.syncActiveDeckDom();
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
    this.safeResetAudioElement();
    usePlayerStore.getState().setStatus("paused");
    log("cyan", "playback", "pending load cancelled");
  }

  public async preloadTrack(track: Track): Promise<void> {
    if (this.currentTrackId === track.id) return;
    if (this.preloadingTrackId === track.id) return;

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
        if (!(await audioCache.saveAudioBlob(track.id, blob, blob.type, generation))) return;
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
    this.currentTrackId = track.id;
    this.loadStartTime = performance.now();
    this.updateMediaSessionMetadata(track);

    store.setStatus("loading", null);
    store.setPosition(startPositionMs > 0 ? startPositionMs : 0);

    this.pauseForTransition();

    try {
      const cachedAudio = bypassCache ? null : await linerDb.getAudio(track.id);
      if (epoch !== this.loadEpoch || controller.signal.aborted) {
        return;
      }

      const isValidCachedBlob =
        Boolean(cachedAudio?.blob) &&
        cachedAudio!.blob.size > 0 &&
        (!cachedAudio!.blob.type || cachedAudio!.blob.type.startsWith("audio/"));

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
        log(
          "green",
          "playback",
          `started (cached): ${track.title} in ${audioStartLatencyMs}ms`,
        );
        return;
      }

      const stream = await resolvePlaybackStream(track, controller.signal);
      this.ttfbMs = Math.round(performance.now() - this.loadStartTime);

      if (epoch !== this.loadEpoch || controller.signal.aborted) {
        log("yellow", "playback", `superseded before stream ready (${track.title})`);
        return;
      }

      const streamCodec = stream.codec;
      const streamBitrate = stream.bitrate;
      this.currentSessionExpiresAt = stream.expiresAtMs;
      log("cyan", "playback", `resolved stream for ${track.title}`);
      const url = stream.blob ? URL.createObjectURL(stream.blob) : stream.url;
      this.attachSource(url, Boolean(stream.blob), track.id);
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
      log(
        "green",
        "playback",
        `started: ${track.title} in ${audioStartLatencyMs}ms`,
      );

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
        log("yellow", "playback", "autoplay blocked — waiting for user gesture");
        usePlayerStore.getState().setStatus("paused");
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
    usePlayerStore.getState().setStatus("paused");
    log("cyan", "audio", "pause requested (fading out)");

    this.fadeVolume(0, 180, () => {
      if (epoch !== this.loadEpoch) return;
      this.audio.pause();
      if (this.isTransitioning) {
        const standbyIndex = 1 - this.activeDeckIndex;
        this.decks[standbyIndex].pause();
      }
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
      void this.loadAndPlay(
        currentTrack,
        usePlayerStore.getState().positionMs,
      );
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
              log("yellow", "playback", "resume failed — attempting cache/stream recovery");
              void this.loadAndPlay(currentTrack, usePlayerStore.getState().positionMs, true);
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
    this.crossfadeAttemptedTrackId = null;
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

  private async downloadAudioBlob(stream: PlaybackStream, signal: AbortSignal): Promise<Blob | null> {
    if (stream.blob) return stream.blob;
    const startedAt = performance.now();
    const bytes = await downloadAudioBytes(stream.url, {
      contentLength: stream.contentLength,
      signal,
    });
    if (!bytes || signal.aborted) return null;
    const mimeType = stream.mimeType || "audio/webm";
    if (!mimeType.startsWith("audio/") && !mimeType.startsWith("video/")) return null;
    if (!isStandaloneAudioFile(bytes.subarray(0, 16))) {
      log("yellow", "download", `not caching: stream is not a standalone audio file`);
      return null;
    }
    log(
      "cyan",
      "download",
      `${Math.round(bytes.byteLength / 1024)} KB in ${Math.round(performance.now() - startedAt)}ms (${stream.contentLength ? "chunked" : "single request"})`,
    );
    return new Blob([bytes], { type: mimeType });
  }

  private cacheAudioInBackground(track: Track, stream: PlaybackStream, signal: AbortSignal) {
    if (track.durationMs && track.durationMs > 20 * 60 * 1000) return;
    const generation = audioCache.currentGeneration();
    void (async () => {
      try {
        const blob = await this.downloadAudioBlob(stream, signal);
        if (!blob || signal.aborted) return;
        if (!(await audioCache.saveAudioBlob(track.id, blob, blob.type, generation))) return;
        await linerDb.putTrack(track);
        log("green", "playback", `background cached: ${track.title} (${Math.round(blob.size / 1024)} KB)`);
      } catch {}
    })();
  }
}

export const playerRuntime =
  typeof window !== "undefined" ? new PlayerRuntime() : null;
