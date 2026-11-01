import { cn } from "@/shared/lib";

const glass = "pointer-events-none absolute bg-black/35";

const CORNER_CLIP = "path('M0 0H6A12 12 0 0 0 18 12V18H0Z')";

export function FullscreenFrameGlass() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
      <div className={cn(glass, "inset-x-0 top-0 h-1.5")} />
      <div className={cn(glass, "top-1.5 bottom-[18px] left-0 w-1.5")} />
      <div className={cn(glass, "top-1.5 right-0 bottom-[18px] w-1.5")} />
      <div className={cn(glass, "right-[18px] bottom-0 left-[18px] h-1.5")} />
      <div
        className={cn(glass, "bottom-0 left-0 h-[18px] w-[18px]")}
        style={{ clipPath: CORNER_CLIP }}
      />
      <div
        className={cn(glass, "right-0 bottom-0 h-[18px] w-[18px] -scale-x-100")}
        style={{ clipPath: CORNER_CLIP }}
      />
    </div>
  );
}
