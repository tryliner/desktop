import type { ComponentType } from "react";
import { Search2Line, CloseCircleFill, CloseLine } from "@mingcute/react";
import { Book2, QuestionCircle } from "@solar-icons/react";
import { useScrollFade } from "@/shared/hooks";
import TextInput from "@/shared/ui/TextInput";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { SettingsUserFooter } from "./SettingsUserFooter";
import {
  NavItem,
  GroupLabel,
  type SettingsNavIconProps,
} from "./SettingsNavItem";

export type { SettingsNavIconProps };

interface SettingsSidebarProps<T extends string> {
  groups: { labelKey: string; ids: T[] }[];
  activeTab: T;
  onSelect: (id: T) => void;
  labels: Record<T, string>;
  icons: Record<T, ComponentType<SettingsNavIconProps>>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClose: () => void;
  className?: string;
}

export function SettingsSidebar<T extends string>({
  groups,
  activeTab,
  onSelect,
  labels,
  icons,
  searchQuery,
  onSearchChange,
  onClose,
  className,
}: SettingsSidebarProps<T>) {
  const { t } = useTranslation();
  const { attach, onScroll, style } = useScrollFade<HTMLElement>();
  const openExternal = (url: string) =>
    window.open(url, "_blank", "noopener,noreferrer");

  return (
    <aside className={cn("min-h-0 w-full md:w-[240px] shrink-0 flex-col font-sans", className)}>
      <div className="flex items-center justify-between px-[16px] pt-[16px] pb-[4px] md:hidden">
        <h2 className="text-heading font-[600] text-text-primary m-0">
          {t("settings.title") || "Settings"}
        </h2>
        <button
          type="button"
          aria-label={t("common.close") || "Close"}
          onClick={onClose}
          className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-control bg-fill text-text-tertiary hover:text-text-primary"
        >
          <CloseLine size={18} />
        </button>
      </div>
      <div className="px-[12px] pt-[12px] pb-[12px]">
        <TextInput
          size="sm"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("settings.search_placeholder")}
          aria-label={t("settings.search_placeholder")}
          className="!gap-[8px] !rounded-item !border-transparent !bg-fill"
          icon={<Search2Line size={14} className="text-text-tertiary" />}
          rightSlot={
            searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="flex cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-text-tertiary hover:text-text-primary"
              >
                <CloseCircleFill size={14} />
              </button>
            ) : null
          }
        />
      </div>

      <nav
        ref={attach}
        onScroll={onScroll}
        style={style}
        role="tablist"
        aria-label={t("settings.title")}
        className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-[10px] pt-[4px] pb-[12px]"
      >
        {groups.length === 0 ? (
          <p className="m-0 px-[8px] text-caption text-text-tertiary">
            {t("search.no_results")}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.labelKey} className="flex flex-col gap-[1px]">
              <GroupLabel>{t(`settings.groups.${group.labelKey}`)}</GroupLabel>
              {group.ids.map((id) => (
                <NavItem
                  key={id}
                  role="tab"
                  icon={icons[id]}
                  label={labels[id]}
                  active={id === activeTab}
                  onClick={() => onSelect(id)}
                />
              ))}
            </div>
          ))
        )}

        <div className="flex flex-col gap-[1px]">
          <GroupLabel>{t("settings.groups.help")}</GroupLabel>
          <NavItem
            icon={Book2}
            label={t("settings.docs")}
            onClick={() =>
              openExternal(
                "https://github.com/tryliner/desktop/blob/main/README.md",
              )
            }
          />
          <NavItem
            icon={QuestionCircle}
            label={t("settings.support")}
            onClick={() => openExternal("https://discord.gg/liner")}
          />
        </div>
      </nav>

      <SettingsUserFooter onClose={onClose} />
    </aside>
  );
}
