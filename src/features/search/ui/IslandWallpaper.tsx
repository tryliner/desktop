import { memo, useLayoutEffect, useCallback, useState } from "react";

export interface IslandWallpaperProps {
  appFrameRef?: React.RefObject<HTMLElement | null>;
  islandRef: React.RefObject<HTMLElement | null>;
  backgroundImage: string | null;
  backgroundBlur: number;
  backgroundDim: number;
  drawerStyle: React.CSSProperties;
}

export const IslandWallpaper = memo(function IslandWallpaper({
  appFrameRef,
  islandRef,
  backgroundImage,
  backgroundBlur,
  backgroundDim,
  drawerStyle,
}: IslandWallpaperProps) {
  const [offsets, setOffsets] = useState(() => ({
    offsetX: 0,
    offsetY: 0,
    frameWidth: typeof window !== "undefined" ? window.innerWidth : 1200,
    frameHeight: typeof window !== "undefined" ? window.innerHeight : 800,
  }));

  const updateOffsets = useCallback(() => {
    const island = islandRef.current;
    if (!island) return;
    const islandRect = island.getBoundingClientRect();
    const frame = appFrameRef?.current;
    const frameRect = frame
      ? frame.getBoundingClientRect()
      : {
          left: 0,
          top: 0,
          width: window.innerWidth,
          height: window.innerHeight,
        };

    setOffsets({
      offsetX: islandRect.left - frameRect.left,
      offsetY: islandRect.top - frameRect.top,
      frameWidth: frameRect.width,
      frameHeight: frameRect.height,
    });
  }, [appFrameRef, islandRef]);

  useLayoutEffect(() => {
    updateOffsets();
    const id = requestAnimationFrame(updateOffsets);
    const timer = setTimeout(updateOffsets, 200);
    window.addEventListener("resize", updateOffsets);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(timer);
      window.removeEventListener("resize", updateOffsets);
    };
  }, [updateOffsets]);

  if (!backgroundImage) return null;

  return (
    <div
      className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none"
      style={{ borderRadius: "inherit" }}
      aria-hidden="true"
    >
      <img
        src={backgroundImage}
        alt=""
        className="absolute select-none pointer-events-none max-w-none"
        style={{
          top: `${-offsets.offsetY}px`,
          left: `${-offsets.offsetX}px`,
          width: `${offsets.frameWidth}px`,
          height: `${offsets.frameHeight}px`,
          objectFit: "cover",
          filter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : undefined,
          transform: backgroundBlur > 0 ? "scale(1.05)" : undefined,
        }}
      />
      {backgroundDim > 0 && (
        <div
          className="absolute inset-0 bg-black pointer-events-none"
          style={{ opacity: backgroundDim / 100 }}
        />
      )}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: drawerStyle.background,
          backdropFilter: drawerStyle.backdropFilter,
          WebkitBackdropFilter: drawerStyle.WebkitBackdropFilter,
        }}
      />
    </div>
  );
});

export default IslandWallpaper;
