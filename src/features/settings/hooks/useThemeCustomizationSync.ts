import { useEffect } from "react";
import { useEffectiveCoverGlow } from "../store/customizationStore";

export function useThemeCustomizationSync() {
  const coverGlow = useEffectiveCoverGlow();

  useEffect(() => {
    document.documentElement.dataset.coverGlow = coverGlow ? "on" : "off";
  }, [coverGlow]);
}
