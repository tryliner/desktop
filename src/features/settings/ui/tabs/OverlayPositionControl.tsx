import { useTranslation } from "@/languages";
import {
  useOverlaySettingsStore,
  type OverlayPosition,
} from "@/features/overlay";
import { SegmentedControl } from "../controls";

const POSITION_ROWS = [
  ["top-left", "top-center", "top-right"],
  ["bottom-left", "bottom-center", "bottom-right"],
] as const satisfies readonly (readonly OverlayPosition[])[];

export function OverlayPositionControl({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation();
  const position = useOverlaySettingsStore((s) => s.position);
  const setPosition = useOverlaySettingsStore((s) => s.setPosition);

  return (
    <div
      role="group"
      aria-label={t("settings.overlay.position.title")}
      className="flex flex-col items-end gap-1.5"
    >
      {POSITION_ROWS.map((row) => (
        <SegmentedControl<OverlayPosition>
          key={row[0]}
          options={row.map((value) => ({
            value,
            label: t(`settings.overlay.position.${value.replace("-", "_")}`),
          }))}
          value={position}
          onChange={setPosition}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
