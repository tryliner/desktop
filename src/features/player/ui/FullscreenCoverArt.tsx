import { MusicNote } from "@solar-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCoverReady, CoverImage } from "@/features/covers";
import { cn } from "@/shared/lib";
import { usePlayerStore } from "../store/playerStore";

interface FullscreenCoverArtProps {
  sizes: string;
}

export function FullscreenCoverArt({ sizes }: FullscreenCoverArtProps) {
  const track = usePlayerStore((s) => s.currentTrack);
  const coverUrl = track?.coverUrl || "";
  const isCoverLoaded = useCoverReady(coverUrl);

  return (
    <motion.div
      layout
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      data-ambient-hole
      style={{ borderRadius: 12 }}
      className={cn(
        "relative aspect-square w-full shrink-0 overflow-hidden bg-black/20",
        coverUrl && !isCoverLoaded && "animate-pulse",
      )}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={track?.id || coverUrl || "empty"}
          initial={{ opacity: 0, filter: "blur(8px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="absolute inset-0"
        >
          {coverUrl ? (
            <CoverImage
              key={coverUrl}
              src={coverUrl}
              alt={track?.title || ""}
              fill
              sizes={sizes}
              priority
              unoptimized
              className="rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-white/5 text-white/40">
              <MusicNote size={64} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
