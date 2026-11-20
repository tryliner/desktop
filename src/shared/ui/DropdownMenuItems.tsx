import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DropdownMenuItem } from "./DropdownMenu";
import { DropdownMenuRow } from "./DropdownMenuRow";
import { DropdownFlyout } from "./DropdownFlyout";

const FLYOUT_CLOSE_DELAY_MS = 180;

interface DropdownMenuItemsProps {
  items: DropdownMenuItem[];
  ownerId: string;
  onClose: () => void;
}

export function DropdownMenuItems({
  items,
  ownerId,
  onClose,
}: DropdownMenuItemsProps) {
  const [flyout, setFlyout] = useState<{ id: string; rect: DOMRect } | null>(
    null,
  );
  const closeTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const openFlyout = (id: string, el: HTMLElement) => {
    window.clearTimeout(closeTimer.current);
    setFlyout({ id, rect: el.getBoundingClientRect() });
  };
  const scheduleClose = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(
      () => setFlyout(null),
      FLYOUT_CLOSE_DELAY_MS,
    );
  };

  const flyoutItem = flyout
    ? items.find((item) => item.id === flyout.id)
    : undefined;

  return (
    <div className="flex flex-col gap-[1px]">
      {items.map((item) => {
        const hasChildren = Boolean(item.children?.length);
        const expanded = flyout?.id === item.id;
        return (
          <div key={item.id} className="contents">
            {item.separator && (
              <div
                role="separator"
                className="mx-[6px] my-[3px] h-px bg-border-alpha-14"
              />
            )}
            <DropdownMenuRow
              label={item.label}
              icon={item.icon}
              danger={item.danger}
              disabled={item.disabled}
              highlighted={Boolean(item.active) || expanded}
              current={Boolean(item.active)}
              hasChildren={hasChildren}
              expanded={expanded}
              onMouseEnter={(e) => {
                if (hasChildren) openFlyout(item.id, e.currentTarget);
                else if (flyout) scheduleClose();
              }}
              onMouseLeave={() => {
                if (hasChildren) scheduleClose();
              }}
              onKeyDown={(e) => {
                if (hasChildren && e.key === "ArrowRight") {
                  e.preventDefault();
                  openFlyout(item.id, e.currentTarget);
                }
              }}
              onClick={async (e) => {
                e.stopPropagation();
                if (hasChildren) {
                  openFlyout(item.id, e.currentTarget);
                  return;
                }
                onClose();
                await item.onClick();
              }}
            />
          </div>
        );
      })}
      {flyout &&
        flyoutItem?.children &&
        typeof document !== "undefined" &&
        createPortal(
          <DropdownFlyout
            anchor={flyout.rect}
            ownerId={ownerId}
            onBack={() => setFlyout(null)}
            onEnter={() => window.clearTimeout(closeTimer.current)}
            onLeave={scheduleClose}
          >
            <DropdownMenuItems
              items={flyoutItem.children}
              ownerId={ownerId}
              onClose={onClose}
            />
          </DropdownFlyout>,
          document.body,
        )}
    </div>
  );
}
