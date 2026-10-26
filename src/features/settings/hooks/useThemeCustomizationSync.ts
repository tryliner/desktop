import { useEffect } from "react";
import { useTheme } from "next-themes";
import {
  useCustomizationStore,
  selectIsGlassThemeActive,
  useEffectiveCoverGlow,
} from "../store/customizationStore";

export function useThemeCustomizationSync() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isGlassActive = useCustomizationStore(selectIsGlassThemeActive);
  const coverGlow = useEffectiveCoverGlow();

  useEffect(() => {
    document.documentElement.dataset.coverGlow = coverGlow ? "on" : "off";
  }, [coverGlow]);

  useEffect(() => {
    if (isGlassActive && (theme === "light" || resolvedTheme === "light")) {
      setTheme("dark");
    }
  }, [isGlassActive, theme, resolvedTheme, setTheme]);

  return { isGlassActive };
}
