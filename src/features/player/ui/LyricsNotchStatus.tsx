import { MusicFill } from "@mingcute/react";
import { useTranslation } from "@/languages";

interface LyricsNotchStatusProps {
  kind: "loading" | "missing" | "instrumental";
}

export function LyricsNotchStatus({ kind }: LyricsNotchStatusProps) {
  const { t } = useTranslation();

  if (kind === "loading") {
    return (
      <span
        role="status"
        aria-label={t("common.loading")}
        className="flex h-[26px] w-[26px] items-center justify-center"
      >
        <span className="h-[14px] w-[14px] animate-spin rounded-full border-[1.5px] border-white/70 border-t-transparent" />
      </span>
    );
  }

  return (
    <span className="flex h-[26px] items-center pr-[5px] font-sans whitespace-nowrap text-white/70">
      <span className="flex h-[26px] w-[26px] items-center justify-center">
        <MusicFill size={16} />
      </span>
      <span className="text-[12px] leading-[26px] font-[500]">
        {kind === "missing"
          ? t("player.no_lyrics")
          : t("player.instrumental").replace(/^♪\s*/, "")}
      </span>
    </span>
  );
}
