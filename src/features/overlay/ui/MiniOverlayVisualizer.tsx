import { useEffect, useRef } from "react";

export function MiniOverlayVisualizer({
  isPlaying,
  volume,
  isActive = true,
}: {
  isPlaying: boolean;
  volume: number;
  isActive?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const barCount = 14;
    const heights = new Array(barCount).fill(2);

    const render = (time: number) => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const effectiveVolume = Math.max(0.35, Math.min(1, volume));
      const gap = 3;
      const totalGaps = (barCount - 1) * gap;
      const barWidth = Math.max(2, (width - totalGaps) / barCount);

      let isSettled = true;
      for (let i = 0; i < barCount; i++) {
        let targetHeight = 2;
        if (isPlaying) {
          isSettled = false;
          const t = time * 0.005;
          const wave1 = Math.sin(t * 1.8 + i * 0.7);
          const wave2 = Math.cos(t * 2.5 - i * 0.5);
          const wave3 = Math.sin(t * 3.6 + i * 1.2);
          const combined = (wave1 + wave2 * 0.7 + wave3 * 0.5 + 2.2) / 4.4;
          const centerBoost = 1 - Math.abs((i - 6) / barCount) * 0.35;
          targetHeight = Math.max(
            2,
            Math.min(
              height - 2,
              combined * height * effectiveVolume * centerBoost,
            ),
          );
        }

        heights[i] += (targetHeight - heights[i]) * 0.3;
        if (Math.abs(heights[i] - targetHeight) > 0.05) {
          isSettled = false;
        }
        const barH = heights[i];
        const x = i * (barWidth + gap);
        const y = height - barH;

        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, "rgba(255, 255, 255, 0.45)");
        gradient.addColorStop(1, "rgba(255, 255, 255, 0.95)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(x, y, barWidth, barH, 2);
        } else {
          ctx.rect(x, y, barWidth, barH);
        }
        ctx.fill();
      }

      if (!isPlaying && isSettled) {
        return;
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isActive, isPlaying, volume]);

  return (
    <div className="flex items-center h-full w-full py-1">
      <canvas
        ref={canvasRef}
        width={130}
        height={22}
        className="h-[22px] w-[130px] select-none"
      />
    </div>
  );
}
