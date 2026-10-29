import { useMemo } from "react";
import { TranslateFill, TranslateLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { hasRomanizableLyrics } from "../engine/lyricsRomanization";
import { useLyricsDisplayStore } from "../store/lyricsDisplayStore";
import { useLyricsStore } from "../store/lyricsStore";
import { RomanizationOptions } from "./RomanizationOptions";

export function RomanizationToggle() {
  const { t } = useTranslation();
  const braccatoLyrics = useLyricsStore((s) => s.braccatoLyrics);
  const romanization = useLyricsDisplayStore((s) => s.romanization);
  const setRomanization = useLyricsDisplayStore((s) => s.setRomanization);
  const canRomanize = useMemo(
    () =>
      hasRomanizableLyrics(braccatoLyrics) ||
      hasRomanizableLyrics(braccatoLyrics, "ja"),
    [braccatoLyrics],
  );

  if (!canRomanize) return null;

  const label = t("settings.lyrics_romanization.title");

  return (
    <>
      <div className="w-[1px] h-[14px] bg-white/15 mx-[1px]" />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.currentTarget.blur();
          setRomanization(!romanization);
        }}
        aria-label={label}
        aria-pressed={romanization}
        title={label}
        className={cn(
          "w-[26px] h-[26px] min-w-[26px] min-h-[26px] max-h-[26px] rounded-md flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all border-none bg-transparent cursor-pointer",
          romanization ? "text-white" : "text-white/70 hover:text-white",
        )}
      >
        {romanization ? (
          <TranslateFill size={14} />
        ) : (
          <TranslateLine size={14} />
        )}
      </button>
      {romanization && <RomanizationOptions lyrics={braccatoLyrics} />}
    </>
  );
}
