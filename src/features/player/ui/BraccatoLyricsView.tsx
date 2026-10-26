import { createElement } from "react";
import type { Lyric } from "@braccato/parsers";
import { cn } from "@/shared/lib";
import { useScrollEdges } from "../hooks/useScrollEdges";
import { useBraccatoLyrics } from "../hooks/useBraccatoLyrics";
import "@braccato/core/element";
import "@braccato/core/styles/variables.css";
import "@braccato/core/styles/lyrics.css";
import "@braccato/core/styles/instrumental.css";

interface BraccatoLyricsViewProps {
  lyrics: Lyric[];
}

export function BraccatoLyricsView({ lyrics }: BraccatoLyricsViewProps) {
  const { elementRef, setElement } = useBraccatoLyrics(lyrics);
  const { atTop, atBottom } = useScrollEdges(elementRef, lyrics);

  return (
    <div className="relative flex flex-col flex-1 w-full h-full min-h-0">
      {createElement("braccato-lyrics", {
        ref: setElement,
        source: "#liner-audio",
        className: "lyrics-edge-fog block flex-1 w-full h-full px-6",
        "data-at-top": atTop ? "" : undefined,
        "data-at-bottom": atBottom ? "" : undefined,
        style: {
          overflowY: "auto",
          overflowX: "hidden",
          position: "relative",
          scrollbarWidth: "none",
        },
      })}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-[18%] backdrop-blur-md transition-opacity duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] [mask-image:linear-gradient(to_bottom,black,transparent)]",
          atTop ? "opacity-0" : "opacity-100",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-[26%] backdrop-blur-md transition-opacity duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] [mask-image:linear-gradient(to_top,black,transparent)]",
          atBottom ? "opacity-0" : "opacity-100",
        )}
      />
    </div>
  );
}
