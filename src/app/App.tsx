import { HashRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ToastProvider, AppleEmojiProvider, RootErrorBoundary } from "@/shared/ui";
import { useWindowDrag } from "@/shared/hooks";
import { useAppIconSync } from "@/features/player";
import { I18nProvider } from "@/languages";
import { AuthLock } from "@/features/auth";
import { CoverSwRegistrar } from "@/features/covers";
import { usePresenceSync } from "@/shared/presence";
import { useThemeCustomizationSync } from "@/features/settings";
import { TouchBarSimulator, useTouchBarSync } from "@/features/touchbar";
import { AppRoutes } from "./routes";
import DeeplinkHandler from "./DeeplinkHandler";
import EnvironmentWarning from "./EnvironmentWarning";
import { ConnectivityWall } from "@/features/connectivity";
import "./globals.css";

function AppIconSync() {
  useAppIconSync();
  return null;
}

function PresenceSync() {
  usePresenceSync();
  return null;
}

function ThemeSync() {
  useThemeCustomizationSync();
  return null;
}

function TouchBarSync() {
  useTouchBarSync();
  return null;
}

export default function App() {
  const isTouchBar = window.location.hash.startsWith("#/touchbar");

  if (isTouchBar) {
    return (
      <ThemeProvider
        attribute="data-theme"
        defaultTheme="dark"
        enableSystem={false}
        forcedTheme="dark"
      >
        <TouchBarSimulator />
      </ThemeProvider>
    );
  }

  useWindowDrag();

  return (
    <HashRouter>
      <CoverSwRegistrar />
      <ThemeProvider
        attribute="data-theme"
        defaultTheme="system"
        enableSystem={true}
        disableTransitionOnChange
      >
        <ThemeSync />
        <AppIconSync />
        <PresenceSync />
        <TouchBarSync />
        <AppleEmojiProvider>
          <I18nProvider>
            <ToastProvider>
              <RootErrorBoundary>
                <DeeplinkHandler />
                <EnvironmentWarning />
                <ConnectivityWall />
                <AuthLock>
                  <AppRoutes />
                </AuthLock>
              </RootErrorBoundary>
            </ToastProvider>
          </I18nProvider>
        </AppleEmojiProvider>
      </ThemeProvider>
    </HashRouter>
  );
}
