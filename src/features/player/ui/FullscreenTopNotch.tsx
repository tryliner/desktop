import type { ReactNode } from "react";
import { Notch } from "@/shared/ui";
import { useGlassBlur } from "../store/visualModeStore";

interface FullscreenTopNotchProps {
  children: ReactNode;
}

export function FullscreenTopNotch({ children }: FullscreenTopNotchProps) {
  const blur = useGlassBlur();
  return (
    <Notch
      align="center"
      tone="glass"
      blur={blur}
      className="pointer-events-auto"
      contentClassName="[&>:first-child>button]:rounded-bl-[11px] [&>:last-child>button]:rounded-br-[11px] [&>:last-child>div:first-child>button:last-child]:rounded-br-[11px]"
    >
      {children}
    </Notch>
  );
}
