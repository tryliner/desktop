import { memo } from "react";
import ScrollableRow from "@/shared/ui/ScrollableRow";
import { useTranslation } from "@/languages";
import type { DailyMix } from "../hooks/useDailyMixes";
import DailyMixCard from "./DailyMixCard";
import MixFluidSquare from "./MixFluidSquare";

export interface DailyMixesSectionProps {
  mixes: DailyMix[];
  headingMarginTop?: string;
  accentCoverUrl?: string;
}

function DailyMixesSection({
  mixes,
  headingMarginTop = "mt-[22px]",
  accentCoverUrl,
}: DailyMixesSectionProps) {
  const { t } = useTranslation();
  if (mixes.length === 0) return null;

  const firstCoverUrl = accentCoverUrl ?? mixes[0]?.coverUrl;

  return (
    <div className="flex flex-col">
      <div
        className={`${headingMarginTop} px-3 flex items-center justify-between`}
      >
        <div className="group flex items-center gap-3">
          <MixFluidSquare coverUrl={firstCoverUrl} />
          <h2 className="font-roboto-flex-heading text-text-primary text-[30px] m-0 leading-none tracking-[-0.02em]">
            {t("home.dailyMixes") || "Your Mixes"}
          </h2>
        </div>
      </div>

      <ScrollableRow className="flex gap-[28px] pl-3 pr-3 mt-[12px] overflow-x-auto pb-[2px]">
        {mixes.map((mix, index) => (
          <DailyMixCard
            key={`daily-mix-${mix.id}-${index}`}
            mix={mix}
            index={index}
          />
        ))}
      </ScrollableRow>
    </div>
  );
}

export default memo(DailyMixesSection);
