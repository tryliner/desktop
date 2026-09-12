import { useState } from "react";
import { useToast } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { ToggleSwitch } from "@/shared/ui";
import { isTelemetryEnabled, setTelemetryEnabled } from "@/shared/telemetry";
import { SettingRow, SettingSection } from "../controls";

export function PrivacyTab() {
  const { t } = useTranslation();
  const [telemetryOptIn, setTelemetryOptIn] = useState(() => isTelemetryEnabled());
  const { toast } = useToast();

  const handleToggleTelemetry = (checked: boolean) => {
    setTelemetryOptIn(checked);
    setTelemetryEnabled(checked);
    toast(checked ? t("settings.telemetry.enabled") : t("settings.telemetry.disabled"), "info");
  };

  return (
    <SettingSection>
      <SettingRow
        title={t("settings.telemetry.title")}
        description={t("settings.telemetry.description")}
        control={
          <ToggleSwitch
            checked={telemetryOptIn}
            onChange={handleToggleTelemetry}
          />
        }
      />
    </SettingSection>
  );
}
