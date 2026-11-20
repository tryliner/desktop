import { useEffect, useRef } from "react";
import { useLyricsStore } from "../store/lyricsStore";
import { usePlayerStore } from "@/features/player/store/playerStore";
import {
  audioElement,
  createMediaClock,
} from "@/features/player/hooks/mediaClock";
import { useCoverSrc } from "@/features/covers";
import { useKawarpEnabled } from "@/features/player/store/visualModeStore";
import { getLyricsPopupPreferences } from "../store/lyricsPopupPreferencesStore";
import { useIsTrackLiked } from "@/features/library/hooks";

function syncLyricsPopupContent(
  mediaClock: ReturnType<typeof createMediaClock>,
  cover: string | undefined,
  kawarpEnabled: boolean,
  liked: boolean,
) {
  const player = usePlayerStore.getState();
  const lyrics = useLyricsStore.getState();
  const track = player.currentTrack;
  const audio = audioElement();
  const artist =
    track?.artists ||
    track?.artistList?.map((item) => item.name).join(", ") ||
    "";

  window.linerElectron?.lyricsPopupUpdateState({
    track: track
      ? {
          id: track.id,
          title: track.title,
          artist,
          album: track.album?.title || "",
          cover: cover || track.coverUrl,
          durationMs: track.durationMs || player.durationMs,
        }
      : null,
    status: audio && !audio.paused ? "playing" : player.status,
    positionMs: mediaClock.timeMs(),
    positionAt: Date.now(),
    playbackRate: audio?.playbackRate || player.playbackRate || 1,
    pitchSemitones: player.pitchSemitones,
    isPitchLinked: player.isPitchLinked,
    isReverbEnabled: player.isReverbEnabled,
    reverbLevel: player.reverbLevel,
    isEqEnabled: player.isEqEnabled,
    eqGains: player.eqGains,
    volume: player.volume,
    repeat: player.repeat,
    shuffle: player.shuffle,
    liked,
    kawarpEnabled,
    lyricsTrackId: lyrics.currentLyricsTrackId,
    lines: lyrics.braccatoLyrics.map((line) => ({
      words: line.words || "",
      startTimeMs: line.startTimeMs || 0,
      durationMs: line.durationMs || 0,
      parts: line.parts?.map((part) => ({
        words: part.words,
        startTimeMs: part.startTimeMs,
        durationMs: part.durationMs,
        isBackground: part.isBackground,
      })),
      agent: line.agent,
      translation: line.translation,
      romanization: line.romanization,
      isInstrumental: line.isInstrumental,
    })),
    loading: lyrics.lyricsLoading,
    instrumental: lyrics.instrumental,
  });
}

function syncLyricsPopupClock(
  mediaClock: ReturnType<typeof createMediaClock>,
) {
  const player = usePlayerStore.getState();
  const audio = audioElement();
  window.linerElectron?.lyricsPopupUpdateClock({
    status: audio && !audio.paused ? "playing" : player.status,
    positionMs: mediaClock.timeMs(),
    positionAt: Date.now(),
    playbackRate: audio?.playbackRate || player.playbackRate || 1,
    pitchSemitones: player.pitchSemitones,
    isPitchLinked: player.isPitchLinked,
    isReverbEnabled: player.isReverbEnabled,
    reverbLevel: player.reverbLevel,
    isEqEnabled: player.isEqEnabled,
    eqGains: player.eqGains,
    repeat: player.repeat,
    shuffle: player.shuffle,
    volume: player.volume,
  });
}

export function useLyricsPopupSync() {
  const trackId = usePlayerStore((state) => state.currentTrack?.id);
  const liked = useIsTrackLiked(trackId);
  const coverUrl = usePlayerStore((state) => state.currentTrack?.coverUrl);
  const cover = useCoverSrc(coverUrl);
  const kawarpEnabled = useKawarpEnabled();
  const mediaClock = useRef<ReturnType<typeof createMediaClock> | null>(null);
  mediaClock.current ??= createMediaClock();

  useEffect(() => {
    window.linerElectron?.lyricsPopupUpdatePreferences?.(
      getLyricsPopupPreferences(),
    );
    const syncContent = () => {
      if (mediaClock.current) {
        syncLyricsPopupContent(mediaClock.current, cover, kawarpEnabled, liked);
      }
    };
    const syncClock = () => {
      if (mediaClock.current) syncLyricsPopupClock(mediaClock.current);
    };
    syncContent();
    const stopPlayer = usePlayerStore.subscribe((state, previous) => {
      if (
        state.currentTrack !== previous.currentTrack ||
        state.shuffle !== previous.shuffle ||
        state.repeat !== previous.repeat ||
        state.playbackContext !== previous.playbackContext
      ) {
        syncContent();
      }
    });
    const stopLyrics = useLyricsStore.subscribe((state, previous) => {
      if (
        state.braccatoLyrics !== previous.braccatoLyrics ||
        state.currentLyricsTrackId !== previous.currentLyricsTrackId ||
        state.lyricsLoading !== previous.lyricsLoading ||
        state.instrumental !== previous.instrumental
      ) {
        syncContent();
      }
    });
    const tick = window.setInterval(syncClock, 80);
    return () => {
      stopPlayer();
      stopLyrics();
      window.clearInterval(tick);
    };
    // The track and cover can change independently of the store listener while a bundle is restored.
  }, [cover, kawarpEnabled, liked, trackId]);
}
