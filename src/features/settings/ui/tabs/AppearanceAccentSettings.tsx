import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { SettingBlock } from "../controls";
import {
  ACCENT_PRESETS,
  isHexColor,
  useAppearanceStore,
} from "../../store/appearanceStore";

const swatchClass =
  "h-[30px] w-[30px] shrink-0 cursor-pointer rounded-full border-0 p-0 transition-transform active:scale-95";

export function AppearanceAccentSettings({
  searchQuery,
}: {
  searchQuery?: string;
}) {
  const { t } = useTranslation();
  const accent = useAppearanceStore((state) => state.accent);
  const setAccent = useAppearanceStore((state) => state.setAccent);
  const isCustom = accent !== null && !ACCENT_PRESETS.some((c) => c === accent);

  const ring = (active: boolean) =>
    active
      ? "ring-2 ring-text-primary ring-offset-2 ring-offset-bg-panel"
      : "ring-1 ring-border-alpha-33";

  return (
    <SettingBlock
      title={t("settings.accent.title")}
      description={t("settings.accent.description")}
      titleKey="settings.accent.title"
      descKey="settings.accent.description"
      searchQuery={searchQuery}
    >
      <div className="flex flex-wrap items-center gap-[12px]">
        <button
          type="button"
          title={t("settings.accent.default")}
          aria-label={t("settings.accent.default")}
          aria-pressed={accent === null}
          onClick={() => setAccent(null)}
          className={cn(swatchClass, "bg-[#ff4d4d]", ring(accent === null))}
        />
        {ACCENT_PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            aria-pressed={accent === color}
            onClick={() => setAccent(color)}
            style={{ backgroundColor: color }}
            className={cn(swatchClass, ring(accent === color))}
          />
        ))}
        <label
          title={t("settings.accent.custom")}
          className={cn(
            swatchClass,
            "relative overflow-hidden bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)]",
            ring(isCustom),
          )}
        >
          <input
            type="color"
            aria-label={t("settings.accent.custom")}
            value={isHexColor(accent) ? accent : "#8b5cf6"}
            onChange={(event) => setAccent(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>
    </SettingBlock>
  );
}
