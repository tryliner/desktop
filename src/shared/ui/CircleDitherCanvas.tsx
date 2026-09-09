import { useEffect, useRef, useState } from "react";

export interface CircleDitherCanvasProps {
  src: string;
  alt?: string;
  dotSize?: number;
  gap?: number;
  edgePadding?: number;
  cornerRadius?: number;
  gridType?: "square" | "hex";
  objectFit?: "cover" | "contain";
  backgroundColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function CircleDitherCanvas({
  src,
  alt = "Circle Dither",
  dotSize = 7,
  gap = 0.5,
  edgePadding = 1.5,
  cornerRadius = 12,
  gridType = "square",
  objectFit = "cover",
  backgroundColor = "transparent",
  className = "",
  style,
}: CircleDitherCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load source image
  useEffect(() => {
    setLoaded(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => {
      imgRef.current = img;
      setLoaded(true);
    };
    return () => {
      img.onload = null;
    };
  }, [src]);

  // Canvas drawing effect
  useEffect(() => {
    if (!loaded) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const offscreenCanvas = document.createElement("canvas");
    const offscreenCtx = offscreenCanvas.getContext("2d", { willReadFrequently: true });
    const ctx = canvas.getContext("2d");
    if (!ctx || !offscreenCtx) return;

    let currentWidth = 0;
    let currentHeight = 0;
    let cachedPixelData: Uint8ClampedArray | null = null;

    const updatePixels = (w: number, h: number) => {
      const img = imgRef.current;
      if (!img || w <= 0 || h <= 0) return null;

      offscreenCanvas.width = w;
      offscreenCanvas.height = h;

      const imgW = img.naturalWidth || img.width;
      const imgH = img.naturalHeight || img.height;
      if (!imgW || !imgH) return null;

      let drawW = w;
      let drawH = h;
      let drawX = 0;
      let drawY = 0;

      const imgAspect = imgW / imgH;
      const canvasAspect = w / h;

      if (objectFit === "cover") {
        if (canvasAspect > imgAspect) {
          drawW = w;
          drawH = w / imgAspect;
          drawX = 0;
          drawY = (h - drawH) / 2;
        } else {
          drawH = h;
          drawW = h * imgAspect;
          drawX = (w - drawW) / 2;
          drawY = 0;
        }
      } else {
        if (canvasAspect > imgAspect) {
          drawH = h;
          drawW = h * imgAspect;
          drawX = (w - drawW) / 2;
          drawY = 0;
        } else {
          drawW = w;
          drawH = w / imgAspect;
          drawX = 0;
          drawY = (h - drawH) / 2;
        }
      }

      offscreenCtx.clearRect(0, 0, w, h);
      offscreenCtx.drawImage(img, drawX, drawY, drawW, drawH);
      return offscreenCtx.getImageData(0, 0, w, h).data;
    };

    const draw = () => {
      if (!cachedPixelData || currentWidth <= 0 || currentHeight <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clip canvas drawing to the rounded rectangle matching the window
      if (cornerRadius > 0) {
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(0, 0, currentWidth, currentHeight, cornerRadius);
        } else {
          const r = Math.min(cornerRadius, currentWidth / 2, currentHeight / 2);
          ctx.moveTo(r, 0);
          ctx.lineTo(currentWidth - r, 0);
          ctx.arcTo(currentWidth, 0, currentWidth, r, r);
          ctx.lineTo(currentWidth, currentHeight - r);
          ctx.arcTo(currentWidth, currentHeight, currentWidth - r, currentHeight, r);
          ctx.lineTo(r, currentHeight);
          ctx.arcTo(0, currentHeight, 0, currentHeight - r, r);
          ctx.lineTo(0, r);
          ctx.arcTo(0, 0, r, 0, r);
          ctx.closePath();
        }
        ctx.clip();
      }

      if (backgroundColor && backgroundColor !== "transparent") {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, currentWidth, currentHeight);
      } else {
        ctx.clearRect(0, 0, currentWidth, currentHeight);
      }

      const size = Math.max(2, dotSize);
      const g = Math.max(0, gap);
      const baseRadius = Math.max(0.4, (size - g) / 2);
      const diameter = baseRadius * 2;
      const minPad = Math.max(0, edgePadding);
      const isHex = gridType === "hex";
      const rowHeight = isHex ? size * 0.8660254 : size;

      const cols = 1 + Math.floor((currentWidth - 2 * minPad - diameter) / size);
      const rows = 1 + Math.floor((currentHeight - 2 * minPad - diameter) / rowHeight);
      if (cols <= 0 || rows <= 0) {
        ctx.restore();
        return;
      }

      const totalGridW = (cols - 1) * size + diameter;
      const totalGridH = (rows - 1) * rowHeight + diameter;
      const padX = (currentWidth - totalGridW) / 2;
      const padY = (currentHeight - totalGridH) / 2;

      const R = Math.max(0, cornerRadius);
      const isInsideCorner = (x: number, y: number, cx: number, cy: number) => {
        const dx = x - cx;
        const dy = y - cy;
        return Math.sqrt(dx * dx + dy * dy) + baseRadius <= R;
      };

      for (let r = 0; r < rows; r++) {
        const y = padY + baseRadius + r * rowHeight;
        const xOffset = isHex && r % 2 === 1 ? size / 2 : 0;

        for (let c = 0; c < cols; c++) {
          const x = padX + baseRadius + c * size + xOffset;

          // Corner radius check: gracefully skip only circles that would be sliced by rounded window corners
          if (R > 0) {
            if (x < R && y < R) {
              if (!isInsideCorner(x, y, R, R)) continue;
            } else if (x > currentWidth - R && y < R) {
              if (!isInsideCorner(x, y, currentWidth - R, R)) continue;
            } else if (x < R && y > currentHeight - R) {
              if (!isInsideCorner(x, y, R, currentHeight - R)) continue;
            } else if (x > currentWidth - R && y > currentHeight - R) {
              if (!isInsideCorner(x, y, currentWidth - R, currentHeight - R)) continue;
            }
          }

          // Strict canvas boundary check: circle must be completely inside
          if (
            x - baseRadius < 0 ||
            x + baseRadius > currentWidth ||
            y - baseRadius < 0 ||
            y + baseRadius > currentHeight
          ) {
            continue;
          }

          const px = Math.min(currentWidth - 1, Math.max(0, Math.floor(x)));
          const py = Math.min(currentHeight - 1, Math.max(0, Math.floor(y)));
          const idx = (py * currentWidth + px) * 4;
          const a = cachedPixelData[idx + 3];
          if (a < 15) continue;

          // Pure, original unmodified RGB colors from the image
          const rVal = cachedPixelData[idx];
          const gVal = cachedPixelData[idx + 1];
          const bVal = cachedPixelData[idx + 2];

          ctx.beginPath();
          ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
          ctx.fillStyle = `rgb(${rVal},${gVal},${bVal})`;
          ctx.fill();
        }
      }

      ctx.restore();
    };

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);

      if (w <= 0 || h <= 0) return;

      currentWidth = w;
      currentHeight = h;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      cachedPixelData = updatePixels(w, h);
      draw();
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);
    handleResize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [loaded, dotSize, gap, edgePadding, cornerRadius, gridType, objectFit, backgroundColor]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden rounded-5xl select-none ${className}`}
      style={style}
      aria-label={alt}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full rounded-5xl pointer-events-none"
      />
    </div>
  );
}
