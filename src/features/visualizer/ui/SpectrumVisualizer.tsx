import { useEffect, useRef } from "react";
import { playerEngine } from "@/features/player/engine/playerEngine";
import { usePlayerStore } from "@/features/player/store/playerStore";
import {
  isWindowVisible,
  onWindowVisibilityChange,
} from "@/shared/utils/windowVisibility";
import { useVisualizerStore, type VisualizerMode } from "../store/visualizerStore";

interface SpectrumVisualizerProps {
  className?: string;
  barCount?: number;
  barColor?: string;
  modeOverride?: VisualizerMode;
  height?: number;
}

export function SpectrumVisualizer({
  className = "",
  barCount = 32,
  barColor,
  modeOverride,
  height,
}: SpectrumVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const status = usePlayerStore((s) => s.status);
  const storeMode = useVisualizerStore((s) => s.mode);
  const mode = modeOverride ?? storeMode;

  useEffect(() => {
    if (mode === "off") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number | null = null;
    let isHibernating = !isWindowVisible();
    const bars = new Float32Array(barCount);
    const decay = 0.89;

    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const targetHeight = Math.max(
        1,
        Math.floor((height !== undefined ? height : rect.height || 400) * dpr)
      );

      if (canvas.width !== width || canvas.height !== targetHeight) {
        canvas.width = width;
        canvas.height = targetHeight;
      }
    };

    updateCanvasSize();
    const resizeObserver = new ResizeObserver(() => updateCanvasSize());
    resizeObserver.observe(canvas);

    const render = () => {
      if (isHibernating || status !== "playing") {
        rafId = null;
        return;
      }

      const analyser = playerEngine.getAnalyserNode();
      const width = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, width, h);

      if (analyser) {
        if (analyser.smoothingTimeConstant !== 0.82) {
          analyser.smoothingTimeConstant = 0.82;
        }

        const binCount = analyser.frequencyBinCount;
        const freqData = new Uint8Array(binCount);
        analyser.getByteFrequencyData(freqData);

        const minFreqIndex = 2; // ~40Hz
        const maxFreqIndex = Math.min(binCount - 1, Math.floor(binCount * 0.72));

        // Limit maximum height of visualizer to 38% of container height (leaves top 62%+ completely open)
        const maxVisualizerHeight = h * 0.38;

        if (mode === "bars") {
          const barWidth = width / barCount;
          const barSpacing = Math.max(3, Math.round(barWidth * 0.20));
          const drawWidth = Math.max(2, barWidth - barSpacing);
          const minHeight = Math.max(6, h * 0.012);

          for (let i = 0; i < barCount; i++) {
            // Perceptual logarithmic mapping across frequency bands
            const startIdx = Math.floor(
              minFreqIndex + Math.pow(i / barCount, 2.2) * (maxFreqIndex - minFreqIndex)
            );
            const endIdx = Math.max(
              startIdx + 1,
              Math.floor(
                minFreqIndex + Math.pow((i + 1) / barCount, 2.2) * (maxFreqIndex - minFreqIndex)
              )
            );

            let sum = 0;
            let peak = 0;
            for (let b = startIdx; b < endIdx; b++) {
              const val = freqData[b] || 0;
              sum += val;
              if (val > peak) peak = val;
            }
            const count = endIdx - startIdx;
            const bandVal = (sum / count) * 0.6 + peak * 0.4;

            // Non-linear power compression (Math.pow ~1.4) to prevent loud spikes from pinning bars to the top
            const rawNormalized = Math.min(1, Math.max(0, bandVal / 255));
            const compressed = Math.pow(rawNormalized, 1.4);

            // Treble compensation tilt
            const tilt = 1.0 + Math.pow(i / barCount, 1.25) * 0.85;
            const targetVal = Math.min(1, compressed * tilt);
            bars[i] = Math.max(targetVal, bars[i] * decay);

            // Bar height capped to maxVisualizerHeight (38% of container)
            const barHeight = Math.max(minHeight, bars[i] * maxVisualizerHeight);
            const x = i * barWidth + barSpacing / 2;
            const y = h - barHeight;
            const radius = Math.min(10, drawWidth / 2);

            if (barColor) {
              ctx.fillStyle = barColor;
            } else {
              // Opacity 0.4 - 0.5 with upward fade for ethereal background glow
              const gradient = ctx.createLinearGradient(0, y, 0, h);
              gradient.addColorStop(0, "rgba(255, 255, 255, 0.18)"); // top: airy & luminous
              gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.35)");
              gradient.addColorStop(1, "rgba(255, 255, 255, 0.48)"); // bottom: grounded 0.48 opacity
              ctx.fillStyle = gradient;
            }

            ctx.beginPath();
            ctx.roundRect(x, y, drawWidth, barHeight, [radius, radius, 0, 0]);
            ctx.fill();
          }
        } else if (mode === "wave") {
          ctx.beginPath();
          ctx.strokeStyle = barColor || "rgba(255, 255, 255, 0.45)";
          ctx.lineWidth = 3 * (window.devicePixelRatio || 1);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          const sliceWidth = width / (barCount - 1);
          let x = 0;

          for (let i = 0; i < barCount; i++) {
            const startIdx = Math.floor(
              minFreqIndex + Math.pow(i / barCount, 2.2) * (maxFreqIndex - minFreqIndex)
            );
            const endIdx = Math.max(
              startIdx + 1,
              Math.floor(
                minFreqIndex + Math.pow((i + 1) / barCount, 2.2) * (maxFreqIndex - minFreqIndex)
              )
            );

            let sum = 0;
            let peak = 0;
            for (let b = startIdx; b < endIdx; b++) {
              const val = freqData[b] || 0;
              sum += val;
              if (val > peak) peak = val;
            }
            const count = endIdx - startIdx;
            const bandVal = (sum / count) * 0.6 + peak * 0.4;
            const rawNormalized = Math.min(1, Math.max(0, bandVal / 255));
            const compressed = Math.pow(rawNormalized, 1.4);
            const tilt = 1.0 + Math.pow(i / barCount, 1.25) * 0.85;
            const targetVal = Math.min(1, compressed * tilt);
            bars[i] = Math.max(targetVal, bars[i] * decay);

            const y = h - Math.max(6, bars[i] * maxVisualizerHeight);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

            x += sliceWidth;
          }
          ctx.stroke();
        }
      }

      rafId = requestAnimationFrame(render);
    };

    if (status === "playing" && !isHibernating) {
      rafId = requestAnimationFrame(render);
    }

    const unwatchVisibility = onWindowVisibilityChange((visible) => {
      isHibernating = !visible;
      if (visible && status === "playing") {
        if (!rafId) rafId = requestAnimationFrame(render);
      } else {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      }
    });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      unwatchVisibility();
    };
  }, [mode, status, barCount, barColor, height]);

  if (mode === "off") return null;

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none w-full ${className}`}
      style={height !== undefined ? { height: `${height}px` } : undefined}
      aria-hidden="true"
    />
  );
}
