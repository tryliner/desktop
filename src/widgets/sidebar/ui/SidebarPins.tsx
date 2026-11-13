import { LuPin } from "react-icons/lu";
import { usePinStore } from "@/features/pins";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { Tooltip } from "@/shared/ui";
import { useScrollFade } from "./SidebarLibrary";
import { PinTile, type PinTooltipSide } from "./SidebarPinTile";
import { useHorizontalWheel } from "./useHorizontalWheel";

export function SidebarPins({
  tooltipSide = "right",
  horizontal = false,
}: {
  tooltipSide?: PinTooltipSide;
  horizontal?: boolean;
}) {
  const { t } = useTranslation();
  const items = usePinStore((state) => state.items);
  const collapsed = usePinStore((state) => state.collapsed);
  const setCollapsed = usePinStore((state) => state.setCollapsed);
  const fade = useScrollFade();
  const wheelRef = useHorizontalWheel<HTMLDivElement>(
    horizontal && !collapsed && items.length > 0,
  );
  const hint = items.length === 0 ? t("pins.empty_hint") : t("pins.title");

  const content = (
    <>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center",
          horizontal ? "h-full pr-[14px] pl-[2px]" : "pb-[16px]",
        )}
      >
        <Tooltip content={hint} side={tooltipSide} sideOffset={12} multiline>
          <button
            type="button"
            aria-label={t("pins.title")}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-control border-0 bg-transparent p-0 text-text-primary opacity-90 transition-opacity hover:opacity-100 [:root[data-user-accent]_&]:text-(--user-accent-icon)"
          >
            <LuPin
              size={21}
              strokeWidth={2.6}
              fill="currentColor"
              className={cn("transition-opacity", collapsed && "opacity-45")}
            />
          </button>
        </Tooltip>
      </div>
      {collapsed || items.length === 0 ? null : (
        <>
          {horizontal ? null : (
            <div className="mx-auto h-px w-[26px] shrink-0 bg-border-alpha-14" />
          )}
          <div
            ref={horizontal ? wheelRef : fade.ref}
            style={horizontal ? undefined : fade.style}
            className={cn(
              horizontal
                ? "min-w-0 overflow-x-auto pr-[12px]"
                : "min-h-0 overflow-y-auto px-[6px] pt-[12px] pb-[6px]",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-[6px]",
                horizontal ? "flex-row" : "flex-col",
              )}
            >
              {items.map((item) => (
                <PinTile key={item.key} item={item} side={tooltipSide} />
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );

  if (!horizontal) return content;
  return (
    <div className="flex h-full min-w-0 flex-row items-center">{content}</div>
  );
}
