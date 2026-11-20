import { useTranslation } from "@/languages";
import { Slider, ToggleSwitch } from "@/shared/ui";
import { SettingBlock, SettingRow } from "../../controls";
import {
  useAppearanceStore,
  type AppearanceSettings,
} from "../../../appearance/appearanceStore";

type NumericKey = "blur" | "dim" | "saturation" | "surfaceOpacity";

interface SliderSpec {
  key: NumericKey;
  titleKey: string;
  descriptionKey?: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

const SLIDERS: SliderSpec[] = [
  {
    key: "blur",
    titleKey: "customization.blur",
    min: 0,
    max: 40,
    step: 1,
    unit: "px",
  },
  { key: "dim", titleKey: "customization.dim", min: 0, max: 0.85, step: 0.01 },
  {
    key: "saturation",
    titleKey: "customization.saturation",
    min: 0.5,
    max: 1.6,
    step: 0.01,
  },
  {
    key: "surfaceOpacity",
    titleKey: "customization.panels",
    descriptionKey: "customization.panels_desc",
    min: 0,
    max: 0.9,
    step: 0.01,
  },
];

const TOGGLES: {
  key: "readable" | "albumBackdrop";
  titleKey: string;
  descriptionKey: string;
}[] = [
  {
    key: "readable",
    titleKey: "customization.readable",
    descriptionKey: "customization.readable_desc",
  },
  {
    key: "albumBackdrop",
    titleKey: "customization.album_backdrop",
    descriptionKey: "customization.album_backdrop_desc",
  },
];

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function WallpaperAdjustments({
  searchQuery,
}: {
  searchQuery?: string;
}) {
  const { t } = useTranslation();
  const settings = useAppearanceStore();
  const set = (patch: Partial<AppearanceSettings>) => settings.set(patch);
  return (
    <>
      {SLIDERS.map((spec) => (
        <SettingBlock
          key={spec.key}
          title={t(spec.titleKey)}
          description={spec.descriptionKey ? t(spec.descriptionKey) : undefined}
          titleKey={spec.titleKey}
          searchQuery={searchQuery}
        >
          <Slider
            ariaLabel={t(spec.titleKey)}
            value={settings[spec.key]}
            min={spec.min}
            max={spec.max}
            step={spec.step}
            unit={spec.unit}
            formatValue={spec.unit ? undefined : percent}
            onChange={(value) => set({ [spec.key]: value })}
          />
        </SettingBlock>
      ))}
      {TOGGLES.map((spec) => (
        <SettingRow
          key={spec.key}
          title={t(spec.titleKey)}
          description={t(spec.descriptionKey)}
          titleKey={spec.titleKey}
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              checked={settings[spec.key]}
              onChange={(value) => set({ [spec.key]: value })}
            />
          }
        />
      ))}
    </>
  );
}
