import { useRef } from "react";
import { useTranslation } from "@/languages";
import { Button, showToast } from "@/shared/ui";
import { SettingBlock } from "../controls";
import {
  clearBackgroundFile,
  saveBackgroundFile,
} from "../../lib/backgroundFile";
import { useAppearanceStore } from "../../store/appearanceStore";
import { RangeControl } from "./RangeControl";

const MAX_BACKGROUND_BYTES = 30 * 1024 * 1024;

export function AppearanceBackgroundSettings({
  searchQuery,
}: {
  searchQuery?: string;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const version = useAppearanceStore((state) => state.backgroundVersion);
  const dim = useAppearanceStore((state) => state.backgroundDim);
  const blur = useAppearanceStore((state) => state.backgroundBlur);
  const setDim = useAppearanceStore((state) => state.setBackgroundDim);
  const setBlur = useAppearanceStore((state) => state.setBackgroundBlur);
  const bump = useAppearanceStore((state) => state.bumpBackgroundVersion);
  const reset = useAppearanceStore((state) => state.resetBackgroundVersion);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast(t("settings.background.invalid"), "error");
      return;
    }
    if (file.size > MAX_BACKGROUND_BYTES) {
      showToast(t("settings.background.too_large"), "error");
      return;
    }
    try {
      await saveBackgroundFile(file);
      bump();
    } catch {
      showToast(t("settings.background.save_failed"), "error");
    }
  };

  const remove = async () => {
    reset();
    await clearBackgroundFile().catch(() => undefined);
  };

  return (
    <SettingBlock
      title={t("settings.background.title")}
      description={t("settings.background.description")}
      titleKey="settings.background.title"
      descKey="settings.background.description"
      searchQuery={searchQuery}
    >
      <div className="flex flex-wrap items-center gap-[10px]">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={(event) => {
            void pick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          {t("settings.background.choose")}
        </Button>
        {version > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => void remove()}>
            {t("settings.background.remove")}
          </Button>
        ) : null}
      </div>
      {version > 0 ? (
        <div className="flex flex-col gap-[10px]">
          <div className="flex items-center justify-between gap-[12px]">
            <span className="text-body text-text-secondary">
              {t("settings.background.dim")}
            </span>
            <RangeControl
              value={dim}
              min={0}
              max={80}
              step={5}
              onChange={setDim}
              format={(value) => `${value}%`}
              ariaLabel={t("settings.background.dim")}
            />
          </div>
          <div className="flex items-center justify-between gap-[12px]">
            <span className="text-body text-text-secondary">
              {t("settings.background.blur")}
            </span>
            <RangeControl
              value={blur}
              min={0}
              max={30}
              step={2}
              onChange={setBlur}
              format={(value) => `${value}px`}
              ariaLabel={t("settings.background.blur")}
            />
          </div>
        </div>
      ) : null}
    </SettingBlock>
  );
}
