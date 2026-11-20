import { AnimatePresence, motion } from "framer-motion";
import { MAX_CROSSFADE_SECONDS, usePlayerStore } from "@/features/player";
import { Slider } from "@/shared/ui";
import { useTranslation } from "@/languages";

const MARKS = Array.from({ length: MAX_CROSSFADE_SECONDS }, (_, i) => i + 1);

export function CrossfadeLength() {
  const { t } = useTranslation();
  const crossfadeOn = usePlayerStore((state) => state.crossfadeSeconds > 0);
  const crossfadeLength = usePlayerStore((state) => state.crossfadeLength);
  const setCrossfadeSeconds = usePlayerStore(
    (state) => state.setCrossfadeSeconds,
  );
  return (
    <AnimatePresence initial={false}>
      {crossfadeOn && (
        <motion.div
          key="crossfade-length"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <div className="px-[16px] pb-[12px]">
            <div className="flex items-center gap-[10px] rounded-item bg-fill-subtle py-[8px] pl-[12px] pr-[10px]">
              <span className="w-[38px] shrink-0 text-caption font-[500] text-text-tertiary">
                {t("settings.transitions.crossfade.shorter")}
              </span>
              <div className="min-w-0 flex-1">
                <Slider
                  ariaLabel={t("settings.transitions.crossfade.length")}
                  ariaValueText={t("settings.transitions.crossfade.seconds", {
                    count: crossfadeLength,
                  })}
                  value={crossfadeLength}
                  min={1}
                  max={MAX_CROSSFADE_SECONDS}
                  step={1}
                  thumb
                  marks={MARKS}
                  showValue={false}
                  onChange={setCrossfadeSeconds}
                />
              </div>
              <span className="w-[30px] shrink-0 text-caption font-[500] text-text-tertiary">
                {t("settings.transitions.crossfade.longer")}
              </span>
              <span className="min-w-[40px] shrink-0 rounded-full bg-fill px-[8px] py-[3px] text-center text-caption font-[600] tabular-nums text-text-primary">
                {t("settings.transitions.crossfade.short", {
                  count: crossfadeLength,
                })}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
