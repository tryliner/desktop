import type { Lyric } from "@braccato/parsers";
import { useTranslation } from "@/languages";
import MenuSelect from "@/shared/ui/MenuSelect";
import type { RomanizationMode } from "../engine/romanizationPreference";
import { useRomanizationPreference } from "../hooks/useRomanizationPreference";
import { useLyricsDisplayStore } from "../store/lyricsDisplayStore";
import { useRomanizationRuntimeStore } from "../store/romanizationRuntimeStore";

export function RomanizationOptions({ lyrics }: { lyrics: Lyric[] }) {
  const { t } = useTranslation();
  const { key, mode } = useRomanizationPreference(lyrics);
  const setLanguageOverride = useLyricsDisplayStore(
    (state) => state.setLanguageOverride,
  );
  const status = useRomanizationRuntimeStore((state) =>
    state.key === key ? state.status : "idle",
  );
  const retry = useRomanizationRuntimeStore((state) => state.retry);
  const prefix = "settings.lyrics_romanization";
  const options = (["auto", "ja", "zh", "off"] as const).map((value) => ({
    value,
    label: t(`${prefix}.mode_${value}`),
  }));
  return (
    <div
      className="flex min-w-0 items-center gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      <MenuSelect<RomanizationMode>
        aria-label={t(`${prefix}.language`)}
        options={options}
        value={mode}
        onChange={(value) => setLanguageOverride(key, value)}
        className="h-[26px] max-w-[100px] rounded-md bg-transparent px-2 text-[12px] text-white hover:bg-white/10 dark:bg-transparent"
      />
      {mode !== "off" && status === "loading" && (
        <span role="status" className="text-[11px] text-white/60">
          {t(`${prefix}.loading`)}
        </span>
      )}
      {mode !== "off" && status === "error" && (
        <>
          <span role="status" className="text-[11px] text-white/60">
            {t(`${prefix}.failed`)}
          </span>
          <button
            type="button"
            onClick={retry}
            className="rounded px-1 text-[11px] text-white hover:bg-white/10"
          >
            {t(`${prefix}.retry`)}
          </button>
        </>
      )}
    </div>
  );
}
