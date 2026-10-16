export interface BackgroundCheck {
  enabled: boolean;
  autoShow: boolean;
  mainMinimized: boolean;
  mainVisible: boolean;
  mainFocused: boolean;
  // another Liner window (overlay, devtools) took focus, so the user is still in the app
  appWindowFocused: boolean;
  overlayShown: boolean;
}

// Alt+Tab only blurs the main window, it never fires "minimize", so the
// overlay also has to come up when Liner goes to the background this way.
export function shouldShowOnBackground(check: BackgroundCheck): boolean {
  if (!check.enabled || !check.autoShow) return false;
  // minimize already has its own handler
  if (check.mainMinimized || !check.mainVisible) return false;
  if (check.mainFocused || check.appWindowFocused) return false;
  // opened by hand: keep it, and don't close it when Liner gets focus back
  if (check.overlayShown) return false;
  return true;
}
