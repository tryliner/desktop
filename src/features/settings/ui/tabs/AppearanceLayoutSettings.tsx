import { useEffect, useState } from "react";
import { useTranslation } from "@/languages";
import { Button } from "@/shared/ui";
import { SegmentedControl, SettingRow } from "../controls";
import {
  MAX_UI_SCALE,
  MIN_UI_SCALE,
  useAppearanceStore,
  type SidebarPosition,
} from "../../store/appearanceStore";
import { RangeControl } from "./RangeControl";

export function AppearanceLayoutSettings({
  searchQuery,
}: {
  searchQuery?: string;
}) {
  const { t } = useTranslation();
  const uiScale = useAppearanceStore((state) => state.uiScale);
  const setUiScale = useAppearanceStore((state) => state.setUiScale);
  const [draftScale, setDraftScale] = useState(uiScale);

  useEffect(() => setDraftScale(uiScale), [uiScale]);
  const position = useAppearanceStore((state) => state.sidebarPosition);
  const setPosition = useAppearanceStore((state) => state.setSidebarPosition);

  const positions: { value: SidebarPosition; label: string }[] = [
    { value: "left", label: t("settings.sidebar_position.left") },
    { value: "top", label: t("settings.sidebar_position.top") },
  ];

  return (
    <>
      <SettingRow
        title={t("settings.ui_scale.title")}
        description={t("settings.ui_scale.description")}
        titleKey="settings.ui_scale.title"
        descKey="settings.ui_scale.description"
        searchQuery={searchQuery}
        control={
          <div className="flex items-center gap-[10px]">
            <RangeControl
              value={draftScale}
              min={MIN_UI_SCALE}
              max={MAX_UI_SCALE}
              step={0.1}
              onChange={setDraftScale}
              onCommit={() => {
                if (draftScale !== uiScale) setUiScale(draftScale);
              }}
              format={(value) => `${Math.round(value * 100)}%`}
              ariaLabel={t("settings.ui_scale.title")}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={uiScale === 1}
              onClick={() => setUiScale(1)}
            >
              {t("settings.ui_scale.reset")}
            </Button>
          </div>
        }
      />
      <SettingRow
        title={t("settings.sidebar_position.title")}
        description={t("settings.sidebar_position.description")}
        titleKey="settings.sidebar_position.title"
        descKey="settings.sidebar_position.description"
        searchQuery={searchQuery}
        control={
          <SegmentedControl<SidebarPosition>
            options={positions}
            value={position}
            onChange={setPosition}
            ariaLabel={t("settings.sidebar_position.title")}
          />
        }
      />
    </>
  );
}
