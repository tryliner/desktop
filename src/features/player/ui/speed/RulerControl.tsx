import { useTranslation } from "@/languages";
import { TickRuler } from "./TickRuler";
import { StepperRow } from "./StepperRow";

export interface RulerControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  neutral?: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}

export function RulerControl({
  label,
  value,
  min,
  max,
  step,
  neutral,
  format,
  onChange,
}: RulerControlProps) {
  const { t } = useTranslation();
  const valueText = format(value);
  const shift = (delta: number) =>
    onChange(Math.min(max, Math.max(min, Number((value + delta).toFixed(3)))));

  return (
    <section className="flex flex-col gap-[6px]">
      <span className="text-[13px] font-[500] text-text-primary">{label}</span>
      <TickRuler
        value={value}
        min={min}
        max={max}
        step={step}
        ariaLabel={label}
        valueText={valueText}
        onChange={onChange}
      />
      <StepperRow
        valueText={valueText}
        decreaseLabel={t("player.decrease") || "Decrease"}
        increaseLabel={t("player.increase") || "Increase"}
        canDecrease={value > min}
        canIncrease={value < max}
        onDecrease={() => shift(-step)}
        onIncrease={() => shift(step)}
        onReset={neutral === undefined ? undefined : () => onChange(neutral)}
      />
    </section>
  );
}
