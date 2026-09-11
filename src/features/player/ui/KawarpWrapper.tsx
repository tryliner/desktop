import { useEffect, useRef, useState } from "react";
import { KawarpEngine } from "../engine/kawarpEngine";
import { getCoverElement } from "@/features/covers";

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

  // Initialize WebGL engine once
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

  // Sync canvas dimensions to container bounding box
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const width = Math.round(rect.width * dpr);
      const height = Math.round(rect.height * dpr);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        engineRef.current?.resize();
      }
    };

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    updateSize();

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Load new src on change with smooth crossfade
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !src) return;

    engine
      .loadImage(src, getCoverElement(src))
      .then(() => {
        setLoaded(true);
        onLoad?.();
      })
      .catch((err) => {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      });
  }, [src, onLoad, onError]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
      />
    </div>
  );
}

export default KawarpWrapper;
