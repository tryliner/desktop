import { useTranslation } from "@/languages";
import { SegmentedControl } from "../controls";

export function OverlayPositionControl<T extends string>({
  rows,
  value,
  onChange,
  disabled,
}: {
  rows: readonly (readonly T[])[];
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t("settings.overlay.position.title")}
      className="flex flex-col items-end gap-1.5"
    >
      {rows.map((row) => (
        <SegmentedControl<T>
          key={row[0]}
          options={row.map((value) => ({
            value,
            label: t(`settings.overlay.position.${value.replace("-", "_")}`),
          }))}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
