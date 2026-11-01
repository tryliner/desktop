import { SafeShieldLine } from "@mingcute/react";
import logo from "@/assets/logo.svg";

export default function ShieldBadge() {
  return (
    <div className="relative size-[48px] shrink-0">
      <div className="absolute inset-0 flex items-center justify-center rounded-[12px] bg-black/[0.06] dark:bg-white/[0.08]">
        <img
          src={logo}
          alt=""
          draggable={false}
          className="theme-logo h-[22px] w-auto select-none object-contain invert dark:invert-0"
        />
      </div>
      <span className="absolute -bottom-[4px] -right-[4px] flex size-[20px] items-center justify-center rounded-full bg-white text-black">
        <SafeShieldLine size={13} />
      </span>
    </div>
  );
}
