import { useEffect } from "react";
import { useTheme } from "next-themes";
import {
  useCustomizationStore,
  selectIsGlassThemeActive,
} from "../store/customizationStore";

// keeps light theme disabled and forces dark mode when wallpaper glass is active
export function useThemeCustomizationSync() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isGlassActive = useCustomizationStore(selectIsGlassThemeActive);

  useEffect(() => {
    // light theme on transparent blurred wallpaper has contrast issues, force dark
    if (isGlassActive && (theme === "light" || resolvedTheme === "light")) {
      setTheme("dark");
    }
  }, [isGlassActive, theme, resolvedTheme, setTheme]);

  return { isGlassActive };
}
