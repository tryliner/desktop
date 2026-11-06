import { CoverImage } from "@/features/covers";
import { usePlayerStore } from "@/features/player";

export default function TrackBadge() {
  const coverUrl = usePlayerStore((state) => state.currentTrack?.coverUrl);
  return (
    <div className="relative aspect-square size-[60px] shrink-0">
      <div className="absolute inset-0 overflow-hidden rounded-item bg-fill">
        {coverUrl && <CoverImage src={coverUrl} alt="" fill />}
      </div>
      <span className="absolute -bottom-[5px] -right-[5px] flex size-[22px] items-center justify-center rounded-full bg-white text-body font-[800] leading-none text-black">
        !
      </span>
    </div>
  );
}
