import { memo, type ReactNode } from "react";
import { Gallery } from "@solar-icons/react";
import { WALLPAPER_BLOCK_STYLE } from "../../store/customizationStore";

const PREVIEW_SCALE = 0.35;
const font = { fontFamily: "var(--font-inter), sans-serif" } as const;
const PREVIEW_BLUR = `blur(${Math.round(24 * PREVIEW_SCALE)}px) saturate(140%)`;

const COVER_SHADES = ["bg-white/[0.16]", "bg-white/[0.12]", "bg-white/[0.18]", "bg-white/[0.1]", "bg-white/[0.14]"];

function glassStyle(hasImage: boolean): React.CSSProperties {
  if (!hasImage) return { background: "rgba(255, 255, 255, 0.05)" };
  return { ...WALLPAPER_BLOCK_STYLE, backdropFilter: PREVIEW_BLUR, WebkitBackdropFilter: PREVIEW_BLUR };
}

function CoverRow() {
  return (
    <div className="grid grid-cols-5 gap-[6px]">
      {COVER_SHADES.map((shade, i) => (
        <div key={i} className="flex min-w-0 flex-col gap-[3px]">
          <span className={`aspect-square w-full rounded-[4px] ${shade}`} />
          <span className="h-[3px] w-4/5 rounded-full bg-white/70" />
          <span className="h-[3px] w-1/2 rounded-full bg-white/30" />
        </div>
      ))}
    </div>
  );
}

function SectionHeading({ width }: { width: number }) {
  return (
    <div className="flex items-center gap-[4px]">
      <span className="h-[8px] w-[8px] rounded-[2px] bg-white/30" />
      <span className="h-[6px] rounded-full bg-white/85" style={{ width }} />
    </div>
  );
}

export interface WallpaperPreviewProps {
  image: string | null;
  blur: number;
  dim: number;
  fade: string | null;
  isDragOver: boolean;
  emptyTitle: string;
  emptyHint: string;
  onPick: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  actions?: ReactNode;
}

function WallpaperPreview({
  image,
  blur,
  dim,
  fade,
  isDragOver,
  emptyTitle,
  emptyHint,
  onPick,
  onDragOver,
  onDragLeave,
  onDrop,
  actions,
}: WallpaperPreviewProps) {
  const hasImage = Boolean(image);
  const scaledBlur = Math.round(blur * PREVIEW_SCALE);
  const glass = glassStyle(hasImage);

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={hasImage ? undefined : onPick}
      className={`group relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-[#0a0a0a] select-none ${
        hasImage ? "" : "cursor-pointer"
      } ${isDragOver ? "ring-2 ring-white/60" : ""}`}
    >
      {image ? (
        <>
          <img
            src={image}
            alt=""
            draggable={false}
            className="absolute max-w-none object-cover pointer-events-none"
            style={{
              inset: -scaledBlur * 2,
              width: `calc(100% + ${scaledBlur * 4}px)`,
              height: `calc(100% + ${scaledBlur * 4}px)`,
              filter: scaledBlur > 0 ? `blur(${scaledBlur}px)` : undefined,
            }}
          />
          {dim > 0 && (
            <div className="absolute inset-0 bg-black pointer-events-none" style={{ opacity: dim / 100 }} />
          )}
          {fade && (
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: fade }} />
          )}
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-white/[0.02] pointer-events-none" />
      )}

      <div
        className={`absolute inset-0 flex flex-col gap-[5px] p-[7px] pointer-events-none transition-opacity duration-200 ${
          hasImage ? "" : "opacity-35 group-hover:opacity-50"
        }`}
      >
        <div className="flex h-[16px] shrink-0 items-center justify-between">
          <span className="ml-[9px] h-[9px] w-[13px] rounded-[3px] bg-white/90" />
          <span className="flex h-[14px] items-center gap-[5px] rounded-[4px] px-[6px]" style={glass}>
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-[2px] w-[5px] rounded-full bg-white/70" />
            ))}
          </span>
        </div>

        <div className="flex min-h-0 flex-1 gap-[6px]">
          <div
            className="flex w-[30px] shrink-0 flex-col items-center gap-[8px] rounded-[7px] py-[9px]"
            style={glass}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-[8px] w-[8px] rounded-[2px] ${i === 0 ? "bg-white" : "bg-white/45"}`}
              />
            ))}
            <span className="mt-auto h-[10px] w-[10px] rounded-full bg-white/30" />
            <span className="h-[7px] w-[7px] rounded-full bg-white/50" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
            <div className="flex min-h-0 flex-1 flex-col gap-[6px] overflow-hidden px-[4px] pt-[2px]">
              <SectionHeading width={58} />
              <CoverRow />
              <div className="mt-[3px]">
                <SectionHeading width={44} />
              </div>
              <CoverRow />
            </div>

            <div
              className="flex h-[26px] shrink-0 items-center gap-[6px] rounded-[7px] px-[7px]"
              style={glass}
            >
              <span className="h-[15px] w-[15px] rounded-[3px] bg-white/25" />
              <span className="flex flex-col gap-[3px]">
                <span className="h-[3px] w-[38px] rounded-full bg-white/80" />
                <span className="h-[3px] w-[24px] rounded-full bg-white/35" />
              </span>
              <span className="mx-auto flex items-center gap-[6px]">
                <span className="h-[5px] w-[5px] rounded-[1px] bg-white/60" />
                <span className="h-[12px] w-[12px] rounded-full bg-white/90" />
                <span className="h-[5px] w-[5px] rounded-[1px] bg-white/60" />
              </span>
              <span className="flex h-[14px] items-center gap-[4px] rounded-[4px] bg-white/10 px-[5px]">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="h-[4px] w-[4px] rounded-[1px] bg-white/55" />
                ))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {!hasImage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[8px] text-center pointer-events-none">
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-md">
            <Gallery size={20} />
          </div>
          <div className="flex flex-col gap-[2px] rounded-[10px] bg-black/45 px-[12px] py-[6px] backdrop-blur-md">
            <span className="text-white text-[13px] font-[500]" style={font}>
              {emptyTitle}
            </span>
            <span className="text-white/60 text-[11.5px]" style={font}>
              {emptyHint}
            </span>
          </div>
        </div>
      )}

      {actions && (
        <div className="absolute inset-0 flex items-center justify-center gap-[6px] bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/30 group-hover:opacity-100 focus-within:opacity-100">
          {actions}
        </div>
      )}
    </div>
  );
}

export default memo(WallpaperPreview);
