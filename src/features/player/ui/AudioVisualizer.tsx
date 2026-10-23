import React, { useEffect, useRef, useState, useCallback } from "react";
import { getAudioAnalyser } from "../engine/audioVisualizerNode";
import { usePlayerState } from "../hooks/usePlayerState";

export type VisualizerMode = "bars" | "waveform" | "circle";

export interface AudioVisualizerProps {
  mode?: VisualizerMode;
  barCount?: number;
  colorScheme?: "neon" | "cyan" | "fire" | "rainbow";
  radius?: number;
  interactive?: boolean;
  isVisible?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function AudioVisualizer({
  mode = "bars",
  barCount = 64,
  colorScheme = "neon",
  radius,
  isVisible = true,
  className = "",
  style,
}: AudioVisualizerProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const player = usePlayerState();
  const isPlaying = player.status === "playing";

  // Physics state for peak decay
  const peaksRef = useRef<Float32Array>(new Float32Array(barCount));
  const velocitiesRef = useRef<Float32Array>(new Float32Array(barCount));

  // Resize buffers if barCount changes
  useEffect(() => {
    peaksRef.current = new Float32Array(barCount);
    velocitiesRef.current = new Float32Array(barCount);
  }, [barCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isDocumentVisible = typeof document !== "undefined" ? !document.hidden : true;

    const handleVisibilityChange = () => {
      isDocumentVisible = typeof document !== "undefined" ? !document.hidden : true;
      if (isDocumentVisible && isVisible) {
        startLoop();
      } else {
        stopLoop();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    let analyser = getAudioAnalyser();
    let freqData = new Uint8Array(analyser?.frequencyBinCount || 1024);
    let timeData = new Uint8Array(analyser?.fftSize || 2048);

    const updateCanvasDimensions = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const width = rect.width > 0 ? rect.width : 300;
      const height = rect.height > 0 ? rect.height : 150;

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
    };

    updateCanvasDimensions();
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateCanvasDimensions())
        : null;
    resizeObserver?.observe(canvas);

    let lastTime = performance.now();

    const render = (now: number) => {
      if (!isDocumentVisible || !isVisible) {
        return;
      }

      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      if (!analyser) {
        analyser = getAudioAnalyser();
        if (analyser) {
          freqData = new Uint8Array(analyser.frequencyBinCount);
          timeData = new Uint8Array(analyser.fftSize);
        }
      }

      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width > 0 ? rect.width : 300;
      const height = rect.height > 0 ? rect.height : 150;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      if (analyser) {
        if (freqData.length !== analyser.frequencyBinCount) {
          freqData = new Uint8Array(analyser.frequencyBinCount);
        }
        if (timeData.length !== analyser.fftSize) {
          timeData = new Uint8Array(analyser.fftSize);
        }
        analyser.getByteFrequencyData(freqData);
        analyser.getByteTimeDomainData(timeData);
      } else {
        freqData.fill(0);
        timeData.fill(128);
      }

      const peaks = peaksRef.current;
      const velocities = velocitiesRef.current;
      const gravity = 180; // gravity for peak decay
      let totalEnergy = 0;

      if (mode === "bars") {
        const numBars = barCount;
        const barSpacing = Math.max(2, width * 0.008);
        const totalSpacing = (numBars - 1) * barSpacing;
        const barWidth = Math.max(2, (width - totalSpacing) / numBars);

        // Linear gradient: Cyan -> Purple -> Hot Pink
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        if (colorScheme === "cyan") {
          gradient.addColorStop(0, "#0088ff");
          gradient.addColorStop(1, "#00f0ff");
        } else if (colorScheme === "fire") {
          gradient.addColorStop(0, "#ff2200");
          gradient.addColorStop(0.5, "#ff8800");
          gradient.addColorStop(1, "#ffee00");
        } else {
          gradient.addColorStop(0, "#00f0ff");
          gradient.addColorStop(0.5, "#8a2be2");
          gradient.addColorStop(1, "#ff007f");
        }

        const binStep = Math.max(1, Math.floor(freqData.length / numBars));

        for (let i = 0; i < numBars; i++) {
          let sum = 0;
          const startBin = i * binStep;
          const endBin = Math.min(freqData.length, (i + 1) * binStep);
          for (let b = startBin; b < endBin; b++) {
            sum += freqData[b];
          }
          const rawValue = (sum / (endBin - startBin || 1)) / 255;
          const barHeight = Math.max(2, rawValue * (height - 12));
          totalEnergy += rawValue;

          // Peak physics
          if (barHeight > peaks[i]) {
            peaks[i] = barHeight;
            velocities[i] = 0;
          } else {
            velocities[i] += gravity * dt;
            peaks[i] = Math.max(0, peaks[i] - velocities[i] * dt);
          }

          const x = i * (barWidth + barSpacing);
          const y = height - barHeight;

          // Draw main bar
          ctx.fillStyle = gradient;
          if (typeof ctx.roundRect === "function") {
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
            ctx.fill();
          } else {
            ctx.fillRect(x, y, barWidth, barHeight);
          }

          // Draw peak cap
          if (peaks[i] > 2) {
            const peakY = height - peaks[i] - 2;
            ctx.fillStyle = "#ff007f";
            ctx.shadowColor = "#ff007f";
            ctx.shadowBlur = 4;
            ctx.fillRect(x, Math.max(0, peakY), barWidth, 2);
            ctx.shadowBlur = 0;
          }
        }
      } else if (mode === "waveform") {
        ctx.beginPath();
        ctx.strokeStyle = colorScheme === "cyan" ? "#00f0ff" : "#00f0ff";
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "rgba(0, 240, 255, 0.75)";
        ctx.shadowBlur = 10;

        const sliceWidth = width / (timeData.length - 1);
        let x = 0;

        for (let i = 0; i < timeData.length; i++) {
          const v = (timeData[i] - 128) / 128.0;
          const y = v * (height * 0.4) + height / 2;
          totalEnergy += Math.abs(v);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (mode === "circle") {
        const cx = width / 2;
        const cy = height / 2;
        const innerRadius = radius || Math.min(cx, cy) * 0.55;
        const maxBarLen = Math.min(cx, cy) - innerRadius - 8;
        const numSpokes = Math.min(64, barCount);
        const binStep = Math.max(1, Math.floor(freqData.length / numSpokes));

        for (let i = 0; i < numSpokes; i++) {
          let sum = 0;
          const startBin = i * binStep;
          const endBin = Math.min(freqData.length, (i + 1) * binStep);
          for (let b = startBin; b < endBin; b++) {
            sum += freqData[b];
          }
          const rawValue = (sum / (endBin - startBin || 1)) / 255;
          totalEnergy += rawValue;
          const barLen = Math.max(2, rawValue * maxBarLen);

          const theta = (i / numSpokes) * Math.PI * 2 - Math.PI / 2;
          const cos = Math.cos(theta);
          const sin = Math.sin(theta);

          const x1 = cx + cos * innerRadius;
          const y1 = cy + sin * innerRadius;
          const x2 = cx + cos * (innerRadius + barLen);
          const y2 = cy + sin * (innerRadius + barLen);

          ctx.beginPath();
          ctx.strokeStyle = `hsl(${(i / numSpokes) * 280 + 180}, 100%, 65%)`;
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }

      ctx.restore();

      // If paused and energy/peaks have decayed to zero, we can idle to save battery
      const peaksSettled = Array.from(peaks).every((p) => p <= 0.5);
      if (!isPlaying && totalEnergy < 0.01 && peaksSettled) {
        stopLoop();
        return;
      }

      rafIdRef.current = requestAnimationFrame(render);
    };

    const startLoop = () => {
      if (rafIdRef.current !== null) return;
      lastTime = performance.now();
      rafIdRef.current = requestAnimationFrame(render);
    };

    const stopLoop = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };

    if (isVisible && isDocumentVisible) {
      startLoop();
    }

    return () => {
      stopLoop();
      resizeObserver?.disconnect();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [mode, barCount, colorScheme, radius, isVisible, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      className={`audio-visualizer-canvas ${className}`}
      style={{
        display: isVisible ? "block" : "none",
        width: "100%",
        height: "100%",
        ...style,
      }}
      data-testid="audio-visualizer"
    />
  );
}
