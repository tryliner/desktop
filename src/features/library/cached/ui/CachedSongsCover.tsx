import cachedSongsCover from "@/assets/cached-songs-cover.svg";
import { cn } from "@/shared/lib";

export default function CachedSongsCover({
  className,
}: {
  className?: string;
}) {
  return (
    <img
      src={cachedSongsCover}
      alt=""
      draggable={false}
      className={cn("h-full w-full select-none object-cover", className)}
    />
  );
}
