import { sidebarNavItems } from "@/features/navigation/data/navigation";
import { useTranslation } from "@/languages";
import { useModalStore } from "@/features/library";
import { Tooltip } from "@/shared/ui";
import { cn } from "@/shared/lib";

export function SidebarSettingsButton() {
  const { t } = useTranslation();
  const settingsOpen = useModalStore((state) => state.settingsOpen);
  const toggleSettings = useModalStore((state) => state.toggleSettings);

  const settingsItem = sidebarNavItems.find((item) => item.id === "settings");
  if (!settingsItem) return null;

  const Icon = settingsItem.Icon;
  const tooltipLabel = t("common.sidebar.settings") || settingsItem.label;

  return (
    <Tooltip content={tooltipLabel} side="right" sideOffset={12}>
      <button
        type="button"
        aria-pressed={settingsOpen}
        onClick={toggleSettings}
        className="group relative inline-flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer active:scale-[0.96] transition-transform duration-100"
      >
        <Icon
          size={26}
          className={cn(
            "relative z-10 text-text-primary transition-opacity duration-150 ease-out",
            settingsOpen ? "opacity-100" : "opacity-55 group-hover:opacity-90",
          )}
        />
      </button>
    </Tooltip>
  );
}
