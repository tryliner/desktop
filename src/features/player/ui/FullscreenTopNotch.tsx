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
    >
      {children}
    </Notch>
  );
}
