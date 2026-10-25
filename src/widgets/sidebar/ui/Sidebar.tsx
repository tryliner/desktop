import { memo } from "react";
import { SidebarNavItems } from "./SidebarNavItems";
import { SidebarSettingsButton } from "./SidebarSettingsButton";
import { cn } from "@/shared/lib";

export interface SidebarProps {
  searchOpen: boolean;
  onSearchToggle: () => void;
}

function Sidebar({ searchOpen, onSearchToggle }: SidebarProps) {
  return (
    <div
      className={cn(
        "h-full w-[58px] rounded-xl flex flex-col overflow-hidden border-none bg-bg-glass backdrop-blur-[20px]",
      )}
    >
      <nav className="relative flex-1 flex flex-col items-center gap-[20px] pt-[16px]">
        <SidebarNavItems
          searchOpen={searchOpen}
          onSearchToggle={onSearchToggle}
        />
      </nav>

      <div className="pt-[16px] pb-[16px] shrink-0 flex flex-col justify-center items-center gap-[20px]">
        <SidebarSettingsButton />
      </div>
    </div>
  );
}

export default memo(Sidebar);
