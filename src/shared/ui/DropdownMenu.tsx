import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DropdownMenuContent } from "./DropdownMenuContent";
import { useDropdownMenuInteraction } from "./useDropdownMenuInteraction";
import { useDropdownMenuPosition } from "./useDropdownMenuPosition";

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void | Promise<void>;
  danger?: boolean;
  disabled?: boolean;
  active?: boolean;
  checked?: boolean;
}

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  position?: { x: number; y: number } | null;
  side?: "top" | "bottom";
  align?: "start" | "end";
}

export default function DropdownMenu({
  trigger,
  items,
  open: controlledOpen,
  onOpenChange,
  position,
  side = "bottom",
  align = "start",
}: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { menuTheme, isFixed, fixedStyle } = useDropdownMenuPosition(
    containerRef,
    menuRef,
    position,
    open,
    side,
    align,
  );
  const { keyboardOpenRef, onMenuKeyDown, onTriggerKeyDown, closeAndFocus } =
    useDropdownMenuInteraction({
      open,
      isFixed,
      setOpen,
      containerRef,
      menuRef,
    });
  const menuContent = (
    <DropdownMenuContent
      open={open}
      menuRef={menuRef}
      menuTheme={menuTheme}
      side={side}
      isFixed={isFixed}
      fixedStyle={fixedStyle}
      onMenuKeyDown={onMenuKeyDown}
      closeAndFocus={closeAndFocus}
      items={items}
    />
  );

  return (
    <div
      ref={containerRef}
      data-dropdown-menu="true"
      className="relative inline-flex"
      onKeyDown={onTriggerKeyDown}
      onClick={(e) => {
        if (!position) {
          e.stopPropagation();
          keyboardOpenRef.current = e.detail === 0;
          setOpen(!open);
        }
      }}
    >
      {trigger}
      {isFixed && typeof document !== "undefined"
        ? createPortal(menuContent, document.body)
        : menuContent}
    </div>
  );
}
