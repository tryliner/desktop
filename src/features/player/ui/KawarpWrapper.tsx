import { useEffect, useRef, useState } from "react";
import { KawarpEngine } from "../engine/kawarpEngine";
import { getCoverElement, useCoverElement } from "@/features/covers";

export const KAWARP_RESIZE_SETTLE_MS = 300;
export const KAWARP_RENDER_SCALE = 0.5;

interface KawarpWrapperProps {
  src?: string;
  onLoad?: () => void;
  onError?: (err: Error) => void;
}

export function KawarpWrapper({ src, onLoad, onError }: KawarpWrapperProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<KawarpEngine | null>(null);
  const [loaded, setLoaded] = useState(false);
  const coverElement = useCoverElement(src);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: KawarpEngine | null = null;
    try {
      engine = new KawarpEngine(canvas, {
        warpIntensity: 1.1,
        blurPasses: 8,
        transitionDuration: 1000,
        animationSpeed: 1.0,
        saturation: 1.3,
        scale: 1.18,
        dithering: 0.008,
      });
      engineRef.current = engine;
      engine.start();
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    return () => {
      engine?.dispose();
      engineRef.current = null;
    };
  }, [onError]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let surfaceWidth = 0;
    let surfaceHeight = 0;

    const surfaceSize = () => {
      const rect = container.getBoundingClientRect();
      return {
        width: Math.round(Math.max(rect.width, window.screen?.width ?? 0)),
        height: Math.round(Math.max(rect.height, window.screen?.height ?? 0)),
      };
    };

    const applySize = () => {
      const { width, height } = surfaceSize();
      if (width <= 0 || height <= 0) return;
      if (width === surfaceWidth && height === surfaceHeight) return;
      surfaceWidth = width;
      surfaceHeight = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = Math.max(1, Math.round(width * KAWARP_RENDER_SCALE));
      canvas.height = Math.max(1, Math.round(height * KAWARP_RENDER_SCALE));
      engineRef.current?.resize();
    };

    const scheduleSize = () => {
      const { width, height } = surfaceSize();
      if (width === surfaceWidth && height === surfaceHeight) return;
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        settleTimer = null;
        applySize();
      }, KAWARP_RESIZE_SETTLE_MS);
    };

    const resizeObserver = new ResizeObserver(scheduleSize);
    resizeObserver.observe(container);
    window.addEventListener("resize", scheduleSize, { passive: true });
    applySize();

    return () => {
      if (settleTimer) clearTimeout(settleTimer);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleSize);
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !src) return;

    let isCancelled = false;
    const element = coverElement || getCoverElement(src);

    engine
      .loadImage(src, element)
      .then(() => {
        if (isCancelled) return;
        setLoaded(true);
        onLoad?.();
      })
      .catch((err) => {
        if (isCancelled) return;
        onError?.(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      isCancelled = true;
    };
  }, [src, coverElement, onLoad, onError]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className={`absolute left-1/2 top-1/2 block max-w-none -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}

export default KawarpWrapper;
