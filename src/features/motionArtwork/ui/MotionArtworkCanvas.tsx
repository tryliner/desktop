import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import type { MotionArtworkResolution } from "../contracts";
import { useMotionArtworkSettingsStore } from "../store/motionArtworkSettingsStore";

interface MotionArtworkCanvasProps {
  resolution: MotionArtworkResolution;
  isPlaying: boolean;
}

// Renders the resolved motion canvas as a decorative looping video. The static
// cover stays underneath: the video only fades in once it can actually play,
// so every failure path degrades to the usual artwork.
export function MotionArtworkCanvas({ resolution, isPlaying }: MotionArtworkCanvasProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hlsInstance: Hls | null = null;
    setReady(false);

    const detach = (): void => {
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
      }
      video.removeAttribute("src");
      video.load();
    };

    try {
      const nativeHlsSupported =
        typeof video.canPlayType === "function" &&
        video.canPlayType("application/vnd.apple.mpegurl") !== "";

      if (resolution.videoUrl.includes(".m3u8") && !nativeHlsSupported && Hls.isSupported()) {
        hlsInstance = new Hls({ enableWorker: true });
        hlsInstance.loadSource(resolution.videoUrl);
        hlsInstance.attachMedia(video);
      } else {
        video.src = resolution.videoUrl;
      }
    } catch {
      video.removeAttribute("src");
    }

    const onCanPlay = (): void => setReady(true);
    video.addEventListener("canplay", onCanPlay);

    return () => {
      video.removeEventListener("canplay", onCanPlay);
      detach();
    };
  }, [resolution.videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      const playResult = video.play?.();
      playResult?.catch(() => undefined);
    } else if (!video.paused) {
      video.pause();
    }
  }, [isPlaying, ready]);

  return (
    <video
      ref={videoRef}
      aria-hidden="true"
      tabIndex={-1}
      muted
      loop
      playsInline
      preload="auto"
      className={`absolute inset-0 h-full w-full rounded-xl object-cover transition-opacity duration-500 ${
        ready ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}

export default MotionArtworkCanvas;
