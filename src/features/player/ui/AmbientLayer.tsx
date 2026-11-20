import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cachedAmbientScript, loadAmbientScript } from "@/shared/media/ambient";
import { cn } from "@/shared/lib";
import { AMBIENT_FADE_MS } from "../hooks/ambientFeed";
import { useAmbientMask } from "../hooks/useAmbientMask";
import {
  useAmbientWorker,
  type AmbientOptions,
} from "../hooks/useAmbientWorker";
import {
  useAmbientEnabled,
  useVisualModeStore,
} from "../store/visualModeStore";
import { usePlayerStore } from "../store/playerStore";

interface AmbientLayerProps {
  trackId: string | undefined;
  playingOverride?: boolean;
}

interface AmbientScene {
  key: string;
  script: string;
}

function sceneKey(script: string): string {
  let hash = 0;
  for (let i = 0; i < script.length; i++) {
    hash = (Math.imul(hash, 31) + script.charCodeAt(i)) | 0;
  }
  return `${script.length}:${hash}`;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

interface AmbientCanvasProps {
  script: string;
  visible: boolean;
}

function AmbientCanvas({ script, visible }: AmbientCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [options, setOptions] = useState<AmbientOptions>();
  const fail = useCallback(() => setFailed(true), []);
  const mask = useAmbientMask(hostRef);
  useAmbientWorker(
    hostRef,
    options?.pixelated ?? false,
    failed ? null : script,
    fail,
    setOptions,
  );
  if (failed) return null;
  return (
    <div
      ref={hostRef}
      aria-hidden
      style={{
        ...mask,
        transitionDuration: `${AMBIENT_FADE_MS}ms`,
        filter: options?.blur ? `blur(${options.blur}px)` : undefined,
      }}
      className={cn(
        "pointer-events-none absolute inset-0 transition-opacity ease-out",
        visible && options ? "opacity-80" : "opacity-0",
      )}
    />
  );
}

function useAmbientScript(trackId: string | undefined): string | null {
  const [loaded, setLoaded] = useState<{
    trackId: string;
    script: string | null;
  }>();

  useEffect(() => {
    if (!trackId || prefersReducedMotion()) return;
    let active = true;
    void loadAmbientScript(trackId).then((script) => {
      if (active) setLoaded({ trackId, script });
    });
    return () => {
      active = false;
    };
  }, [trackId]);

  if (!trackId || prefersReducedMotion()) return null;
  const script =
    loaded?.trackId === trackId ? loaded.script : cachedAmbientScript(trackId);
  return script ?? null;
}

export default function AmbientLayer({
  trackId,
  playingOverride,
}: AmbientLayerProps) {
  const script = useAmbientScript(trackId);
  const storePlaying = usePlayerStore((s) => s.status === "playing");
  const playing = playingOverride ?? storePlaying;
  const enabled = useAmbientEnabled();
  const setAmbientAvailable = useVisualModeStore((s) => s.setAmbientAvailable);
  const wanted = useMemo<AmbientScene | null>(
    () => (enabled && script ? { key: sceneKey(script), script } : null),
    [enabled, script],
  );
  const [shown, setShown] = useState<AmbientScene | null>(wanted);

  useEffect(() => {
    setAmbientAvailable(Boolean(script));
    return () => setAmbientAvailable(false);
  }, [script, setAmbientAvailable]);

  useEffect(() => {
    if (wanted?.key === shown?.key) return;
    const timer = window.setTimeout(
      () => setShown(wanted),
      shown ? AMBIENT_FADE_MS : 0,
    );
    return () => window.clearTimeout(timer);
  }, [wanted, shown]);

  if (!shown) return null;
  return (
    <AmbientCanvas
      key={shown.key}
      script={shown.script}
      visible={playing && wanted?.key === shown.key}
    />
  );
}
