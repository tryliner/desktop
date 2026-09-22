import { usePlayerStore } from "../store/playerStore";
import { api, mediaUrl, ApiError } from "@/shared/api";
import { log } from "@/shared/utils/logger";
import { telemetry } from "@/shared/telemetry";
import { linerDb } from "@/shared/storage";
import type { Track } from "@/shared/types";

export class PlayerRuntime {
  private audio: HTMLAudioElement;
  private currentTrackId: string | null = null;
  private loadEpoch = 0;
  private loadAbortController: AbortController | null = null;
  private isResetting = false;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private stallStartTime: number | null = null;
  private loadStartTime = 0;
  private ttfbMs = 0;
  private activePlayPromise: Promise<void> | null = null;
  private activeBlobUrl: string | null = null;
  private preloadingTrackId: string | null = null;
  private preloadingPromise: Promise<void> | null = null;
  private preloadAbortController: AbortController | null = null;
  private backgroundCacheAbortController: AbortController | null = null;
  public onEnded?: () => void;
  public onError?: (info: { trackId: string; message: string }) => void;

  constructor() {
    if (typeof window !== "undefined") {
      const existing = document.getElementById("liner-audio") as HTMLAudioElement | null;
      if (existing) {
        existing.pause();
        existing.removeAttribute("src");
        existing.load();
        existing.remove();
      }
    }

    this.audio = new Audio();
    this.audio.id = "liner-audio";
    this.audio.crossOrigin = "anonymous";
    this.audio.preload = "auto";
    if (typeof document !== "undefined") {
      document.body.appendChild(this.audio);
    }
    this.setupAudioListeners(this.audio);

    const initialVolume = usePlayerStore.getState().volume;
    this.audio.volume = initialVolume;
    log("cyan", "boot", `volume ${initialVolume}`);

    usePlayerStore.subscribe((state, prevState) => {
      if (state.volume !== prevState.volume) {
        this.cancelFade();
        if (!this.audio.paused) {
          this.audio.volume = state.volume;
        }
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
    audioEl.addEventListener("timeupdate", () => {
      if (this.isResetting || audioEl !== this.audio) return;
      if (!this.currentTrackId) return;
      if (usePlayerStore.getState().status === "loading") return;
      if (Number.isNaN(audioEl.currentTime)) return;

      const posMs = Math.round(audioEl.currentTime * 1000);
      usePlayerStore.getState().setPosition(posMs);
    });

    audioEl.addEventListener("durationchange", () => {
      if (this.isResetting || audioEl !== this.audio) return;
      if (!this.currentTrackId) return;
      if (Number.isNaN(audioEl.duration) || audioEl.duration <= 0) return;

      usePlayerStore.getState().setDuration(Math.round(audioEl.duration * 1000));
    });

    audioEl.addEventListener("waiting", () => {
      if (this.isResetting || audioEl !== this.audio) return;
      log("yellow", "audio", "buffering (waiting)");
      this.stallStartTime = performance.now();
      if (usePlayerStore.getState().status === "playing") {
        usePlayerStore.getState().setStatus("loading");
      }
    });

    audioEl.addEventListener("ended", () => {
      if (this.isResetting || audioEl !== this.audio) return;
      if (!this.currentTrackId) return;

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
      if (this.isResetting || audioEl !== this.audio) return;
      log("cyan", "audio", "paused");
      const st = usePlayerStore.getState().status;
      if (st === "playing") {
        usePlayerStore.getState().setStatus("paused");
      }
    });

    audioEl.addEventListener("error", () => {
      // Discard teardown / abort / reset errors
      if (this.isResetting || audioEl !== this.audio) return;
      if (!this.currentTrackId || !audioEl.src || audioEl.src === window.location.href) return;

      const message = audioEl.error?.message || "Audio playback error";
      const code = audioEl.error?.code;
      console.error("[AudioElementError]", this.currentTrackId, code, message, audioEl.src);
      log("red", "audio", `error (code ${code}): ${message}`);
      usePlayerStore.getState().setStatus("error", message);

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

      this.onError?.({ trackId: this.currentTrackId, message });
    });
  }

  public getCurrentTrackId(): string | null {
    return this.currentTrackId;
  }

  public hasLoadedSourceFor(trackId: string): boolean {
    return (
      this.currentTrackId === trackId &&
      Boolean(this.audio.currentSrc || this.audio.src) &&
      this.audio.src !== window.location.href
    );
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

  private safeResetAudioElement() {
    this.isResetting = true;
    try {
      this.cancelFade();
      this.audio.pause();
      if (this.activeBlobUrl) {
        URL.revokeObjectURL(this.activeBlobUrl);
        this.activeBlobUrl = null;
      }
      this.audio.removeAttribute("src");
      this.audio.load();
    } catch {
    } finally {
      this.isResetting = false;
    }
  }

  public cancelPendingLoad(): void {
    this.loadEpoch += 1;
    this.loadAbortController?.abort();
    this.loadAbortController = null;
    this.backgroundCacheAbortController?.abort();
    this.backgroundCacheAbortController = null;
    this.currentTrackId = null;
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

    const promise = (async () => {
      try {
        const session = await api.createPlaybackSession(
          track.id,
          undefined,
          controller.signal,
        );
        if (controller.signal.aborted) return;

        const url = mediaUrl(session.streamUrl);
        const response = await fetch(url, {
          headers: { Range: "bytes=0-" },
          signal: controller.signal,
        });

        if (!response.ok && response.status !== 206) return;

        const arrayBuffer = await response.arrayBuffer();
        if (controller.signal.aborted) return;

        const mimeType =
          session.mimeType ||
          response.headers.get("content-type") ||
          "audio/webm";
        const blob = new Blob([arrayBuffer], { type: mimeType });
        await linerDb.putAudio(track.id, blob, mimeType);
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

  public async loadAndPlay(track: Track, startPositionMs: number = 0) {
    this.cancelFade();
    const epoch = ++this.loadEpoch;

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

    this.currentTrackId = track.id;
    this.loadStartTime = performance.now();
    this.updateMediaSessionMetadata(track);

    const store = usePlayerStore.getState();
    store.setStatus("loading", null);
    store.setPosition(startPositionMs > 0 ? startPositionMs : 0);

    this.safeResetAudioElement();

    try {
      const cachedAudio = await linerDb.getAudio(track.id);
      if (epoch !== this.loadEpoch || controller.signal.aborted) {
        return;
      }

      if (cachedAudio) {
        void linerDb.putTrack(track);
        const blobUrl = URL.createObjectURL(cachedAudio.blob);
        this.activeBlobUrl = blobUrl;
        this.audio.src = blobUrl;
        this.audio.volume = 0;
        this.audio.load();

        this.seekWhenReady(epoch, startPositionMs);
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

      const session = await api.createPlaybackSession(
        track.id,
        undefined,
        controller.signal,
      );
      this.ttfbMs = Math.round(performance.now() - this.loadStartTime);

      if (epoch !== this.loadEpoch || controller.signal.aborted) {
        log("yellow", "playback", `superseded before stream ready (${track.title})`);
        return;
      }

      const url = mediaUrl(session.streamUrl);
      if (this.activeBlobUrl) {
        URL.revokeObjectURL(this.activeBlobUrl);
        this.activeBlobUrl = null;
      }
      this.audio.src = url;
      this.audio.volume = 0;
      this.audio.load();

      this.seekWhenReady(epoch, startPositionMs);
      log(
        "green",
        "playback",
        `stream attached: ${session.codec} ${session.bitrate} bps (${track.title})`,
      );

      this.cacheAudioInBackground(track, url, session.mimeType, bgCacheController.signal);

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
        `started: ${track.title} in ${audioStartLatencyMs}ms`,
      );

      telemetry.trackPlaybackHealth("INIT_LATENCY", {
        trackId: track.id,
        codec: session.codec,
        bitrate: session.bitrate,
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
    });
  }

  public resume() {
    const epoch = ++this.loadEpoch;
    this.loadAbortController?.abort();
    this.loadAbortController = null;

    const targetVolume = usePlayerStore.getState().volume;
    usePlayerStore.getState().setStatus("playing");
    log("cyan", "audio", "resume requested (fading in)");

    if (!this.audio.src || this.audio.src === window.location.href) {
      const currentTrack = usePlayerStore.getState().currentTrack;
      if (currentTrack) {
        void this.loadAndPlay(
          currentTrack,
          usePlayerStore.getState().positionMs,
        );
        return;
      }
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

  private cacheAudioInBackground(
    track: Track,
    url: string,
    preferredMimeType?: string,
    signal?: AbortSignal,
  ) {
    if (track.durationMs && track.durationMs > 20 * 60 * 1000) return;
    fetch(url, { headers: { Range: "bytes=0-" }, signal })
      .then(async (res) => {
        if (!res.ok && res.status !== 206) return;
        const arrayBuffer = await res.arrayBuffer();
        if (signal?.aborted) return;
        const mimeType = preferredMimeType || res.headers.get("content-type") || "audio/webm";
        const blob = new Blob([arrayBuffer], { type: mimeType });
        await linerDb.putAudio(track.id, blob, mimeType);
        await linerDb.putTrack(track);
        log("green", "playback", `background cached: ${track.title} (${Math.round(blob.size / 1024)} KB)`);
      })
      .catch(() => {});
  }
}

export const playerRuntime =
  typeof window !== "undefined" ? new PlayerRuntime() : null;
