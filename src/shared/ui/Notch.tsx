import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/shared/lib/utils";

const R = 8;
const H = 30;
const PAD_BOTTOM = 4;
const MASK_BLEED = 4;

type NotchAlign = "start" | "center" | "end";

function notchShape(align: NotchAlign, contentWidth: number) {
  const r = R;
  if (align === "center") {
    const w = contentWidth + 2 * r;
    return {
      w,
      h: H,
      left: r,
      d: `M0 0H${w}A${r} ${r} 0 0 0 ${w - r} ${r}V${H - r}A${r} ${r} 0 0 1 ${w - 2 * r} ${H}H${2 * r}A${r} ${r} 0 0 1 ${r} ${H - r}V${r}A${r} ${r} 0 0 0 0 0Z`,
    };
  }
  const w = contentWidth + r;
  if (align === "end") {
    return {
      w,
      h: H + r,
      left: r,
      d: `M0 0H${w}V${H + r}A${r} ${r} 0 0 0 ${w - r} ${H}H${2 * r}A${r} ${r} 0 0 1 ${r} ${H - r}V${r}A${r} ${r} 0 0 0 0 0Z`,
    };
  }
  return {
    w,
    h: H + r,
    left: 0,
    d: `M${w} 0H0V${H + r}A${r} ${r} 0 0 1 ${r} ${H}H${w - 2 * r}A${r} ${r} 0 0 0 ${w - r} ${H - r}V${r}A${r} ${r} 0 0 1 ${w} 0Z`,
  };
}

export interface NotchProps {
  align: NotchAlign;
  tone?: "canvas" | "glass";
  blur?: boolean;
  children: ReactNode;
  className?: string;
}

export function Notch({
  align,
  tone = "canvas",
  blur = true,
  children,
  className,
}: NotchProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);

  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    const update = () =>
      setContentWidth(Math.ceil(node.offsetWidth / 2) * 2);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const { w, h, left, d } = notchShape(align, contentWidth);
  const maskW = w + 2 * MASK_BLEED;
  const maskH = h + 2 * MASK_BLEED;
  const flushBands = [
    `<rect width="${maskW}" height="${MASK_BLEED}"/>`,
    align === "end" &&
      `<rect x="${MASK_BLEED + w}" width="${MASK_BLEED}" height="${maskH}"/>`,
    align === "start" && `<rect width="${MASK_BLEED}" height="${maskH}"/>`,
  ]
    .filter(Boolean)
    .join("");
  const shapeMask = `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${maskW}" height="${maskH}">${flushBands}<path transform="translate(${MASK_BLEED} ${MASK_BLEED})" d="${d}"/></svg>`,
  )}")`;
  const shapeStyle: CSSProperties = {
    width: w,
    height: h,
    maskImage: shapeMask,
    WebkitMaskImage: shapeMask,
    maskSize: `${maskW}px ${maskH}px`,
    WebkitMaskSize: `${maskW}px ${maskH}px`,
    maskPosition: `-${MASK_BLEED}px -${MASK_BLEED}px`,
    WebkitMaskPosition: `-${MASK_BLEED}px -${MASK_BLEED}px`,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  };

  return (
    <div className={cn("relative", className)} style={{ width: w, height: H }}>
      {tone === "glass" && blur && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 backdrop-blur-[2px]"
          style={shapeStyle}
        />
      )}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0 left-0",
          tone === "canvas" ? "bg-bg-canvas" : "bg-black/35",
        )}
        style={shapeStyle}
      />
      <div
        ref={contentRef}
        className={cn(
          "absolute top-0 flex items-center gap-[2px] text-text-primary",
          align === "center" && "px-[4px]",
          align === "end" && "pr-[2px] pl-[6px]",
          align === "start" && "pr-[6px] pl-[2px]",
        )}
        style={{ height: H - PAD_BOTTOM, left }}
      >
        {children}
      </div>
    </div>
  );
}

export default Notch;
