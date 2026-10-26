import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DownLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { usePlayerState } from "../hooks/usePlayerState";
import { PlayerUiElements } from "./PlayerUiElements";
import { preloadCoverArt, useCoverSrc } from "@/features/covers";
import KawarpWrapper from "./KawarpWrapper";
import AmbientLayer from "./AmbientLayer";
import { FullscreenLyricsPanel } from "./FullscreenLyricsPanel";

const KAWARP_FADE_IN_MS = 600;

export interface FullscreenPlayerProps {
  effectsReady?: boolean;
  onClose: () => void;
}

export function FullscreenPlayer({
  effectsReady = true,
  onClose,
}: FullscreenPlayerProps) {
  const { t } = useTranslation();
  const player = usePlayerState();
  const coverUrl = player.currentTrack?.coverUrl;
  const kawarpSrc = useCoverSrc(coverUrl);
  const currentTrackId = player.currentTrack?.id;
  const onError = useCallback((err: Error) => {
    console.error("kawarp load error:", err);
  }, []);

  const [kawarpShown, setKawarpShown] = useState(false);
  const onKawarpLoad = useCallback(() => {
    setTimeout(() => setKawarpShown(true), KAWARP_FADE_IN_MS);
  }, []);

  const nextCoverUrl = player.queue[player.currentIndex + 1]?.coverUrl;
  useEffect(() => {
    void preloadCoverArt(coverUrl);
    void preloadCoverArt(nextCoverUrl);
  }, [coverUrl, nextCoverUrl]);

  useEffect(() => {
    if (!player.currentTrack) {
      onClose();
    }
  }, [player.currentTrack, onClose]);

  return (
    <div
      data-theme="dark"
      className="dark relative h-full w-full overflow-hidden bg-black text-white"
    >
      <div className="absolute inset-0 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ backgroundColor: "var(--color-bg-primary)" }}
        />
        {(kawarpSrc || coverUrl) && !kawarpShown && (
          <div
            className="absolute inset-0 bg-cover bg-center pointer-events-none"
            style={{
              backgroundImage: `url(${kawarpSrc || coverUrl})`,
              filter: "blur(64px) saturate(1.3)",
              transform: "scale(1.3)",
            }}
          />
        )}
        {effectsReady ? (
          <KawarpWrapper
            src={kawarpSrc}
            onLoad={onKawarpLoad}
            onError={onError}
          />
        ) : null}
        <AmbientLayer trackId={currentTrackId} />
      </div>

      <div className="absolute inset-0 z-[1] bg-black/40" />

      <div className="absolute inset-0 z-10 flex">
        <div className="flex-1 flex flex-col items-center justify-center gap-5">
          <PlayerUiElements onClose={onClose} />
        </div>

        <FullscreenLyricsPanel currentTrackId={player.currentTrack?.id} />
      </div>

      <button
        type="button"
        aria-label={t("player.close_fullscreen")}
        onClick={onClose}
        data-no-window-drag
        className="absolute top-[6px] left-[6px] z-30 inline-flex h-[32px] w-[32px] items-center justify-center rounded-lg border-none bg-black/50 backdrop-blur-xl text-white/80 hover:text-white hover:bg-white/10 active:scale-[0.94] transition-all cursor-pointer select-none pointer-events-auto"
      >
        <DownLine size={18} />
      </button>
    </div>
  );
}

export default function PlayerPage() {
  const navigate = useNavigate();
  return <FullscreenPlayer onClose={() => navigate(-1)} />;
}
