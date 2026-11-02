import { TranslateLine, FontLine } from "@mingcute/react";
import { useLyricsStore } from "../store/lyricsStore";
import {
  useAiTranslateStore,
  getTranslationCacheKey,
  getRomanizationCacheKey,
} from "@/features/ai-translate";
import { usePlayerStore } from "@/features/player/store/playerStore";
import { cn } from "@/shared/lib";
import { showToast } from "@/shared/ui";

const NON_LATIN_RE = /[^\p{Script=Latin}\p{P}\p{Z}\p{N}\p{M}\p{S}]/u;

export function LyricsTranslateIslandControls() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const braccatoLyrics = useLyricsStore((s) => s.braccatoLyrics);
  const activeProvider = useLyricsStore((s) => s.activeProvider);

  const {
    showTranslation,
    showRomanization,
    isTranslating,
    isRomanizing,
    toggleTranslation,
    toggleRomanization,
    translateTrackLyrics,
    romanizeTrackLyrics,
    translationsByTrackId,
    romanizationsByTrackId,
    sourceLinesByCacheKey,
    sourceRomLinesByCacheKey,
    targetLang,
    singableMode,
  } = useAiTranslateStore();

  const id = currentTrack?.id ?? "";
  const cacheKey = id ? getTranslationCacheKey(id, targetLang, singableMode, activeProvider) : "";
  const romKey = id ? getRomanizationCacheKey(id, activeProvider) : "";

  const lines = braccatoLyrics.map(
    (l) => l.words || l.parts?.map((p) => p.words).join("") || "",
  );
  const isMatch = (cached: string[] | undefined) =>
    Boolean(cached && cached.length === lines.length && cached.every((l, i) => l === lines[i]));
  const hasTrans = Boolean(
    cacheKey &&
      translationsByTrackId[cacheKey]?.some((l) => l.trim().length > 0) &&
      isMatch(sourceLinesByCacheKey[cacheKey]),
  );
  const hasRom = Boolean(
    romKey &&
      romanizationsByTrackId[romKey]?.some((l) => l.trim().length > 0) &&
      isMatch(sourceRomLinesByCacheKey[romKey]),
  );

  const hasRomanizableLyrics = braccatoLyrics.some((lyric) =>
    NON_LATIN_RE.test(
      lyric.words || lyric.parts?.map((p) => p.words).join("") || "",
    ),
  );

  const handleTrans = async () => {
    if (hasTrans) return toggleTranslation();
    if (!currentTrack || lines.length === 0) return;
    const prevShow = useAiTranslateStore.getState().showTranslation;
    const res = await translateTrackLyrics(currentTrack.id, lines, activeProvider);
    if (res && useAiTranslateStore.getState().showTranslation === prevShow) {
      useAiTranslateStore.getState().setShowTranslation(true);
    } else if (!res) {
      const err = useAiTranslateStore.getState().error;
      if (err) showToast.error("Could not translate lyrics", { description: err });
    }
  };

  const handleRom = async () => {
    if (hasRom) return toggleRomanization();
    if (!currentTrack || lines.length === 0) return;
    const prevShow = useAiTranslateStore.getState().showRomanization;
    const res = await romanizeTrackLyrics(currentTrack.id, lines, activeProvider);
    if (res && useAiTranslateStore.getState().showRomanization === prevShow) {
      useAiTranslateStore.getState().setShowRomanization(true);
    } else if (!res) {
      const err = useAiTranslateStore.getState().error;
      if (err) showToast.error("Could not romanize lyrics", { description: err });
    }
  };

  return (
    <>
      <div className="w-[1px] h-[14px] bg-white/15 mx-[1px]" />
      <button
        type="button"
        onClick={handleTrans}
        disabled={isTranslating}
        aria-label="Toggle Lyrics Translation"
        title={
          hasTrans
            ? showTranslation
              ? "Hide translation"
              : "Show translation"
            : singableMode
              ? "Singable translation"
              : "Translate lyrics"
        }
        className={cn(
          "w-[26px] h-[26px] min-w-[26px] min-h-[26px] max-h-[26px] rounded-control flex items-center justify-center transition-all border-none bg-transparent cursor-pointer",
          showTranslation && hasTrans
            ? "text-white bg-white/20 font-bold"
            : "text-white/70 hover:text-white hover:bg-white/10",
          isTranslating ? "animate-pulse opacity-60" : "active:scale-95",
        )}
      >
        <TranslateLine size={13} />
      </button>

      {hasRomanizableLyrics && (
        <button
          type="button"
          onClick={handleRom}
          disabled={isRomanizing}
          aria-label="Toggle Pronunciation/Romaji"
          title={
            hasRom
              ? showRomanization
                ? "Hide pronunciation"
                : "Show pronunciation"
              : "Pronunciation / Romaji"
          }
          className={cn(
            "w-[26px] h-[26px] min-w-[26px] min-h-[26px] max-h-[26px] rounded-control flex items-center justify-center transition-all border-none bg-transparent cursor-pointer",
            showRomanization && hasRom
              ? "text-white bg-white/20 font-bold"
              : "text-white/70 hover:text-white hover:bg-white/10",
            isRomanizing ? "animate-pulse opacity-60" : "active:scale-95",
          )}
        >
          <FontLine size={13} />
        </button>
      )}
    </>
  );
}
