import { HashRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ToastProvider, AppleEmojiProvider, RootErrorBoundary } from "@/shared/ui";
import { useWindowDrag } from "@/shared/hooks";
import { useAppIconSync } from "@/features/player";
import { I18nProvider } from "@/languages";
import { AuthLock } from "@/features/auth";
import { CoverSwRegistrar } from "@/features/covers";
import { AppRoutes } from "./routes";
import DeeplinkHandler from "./DeeplinkHandler";
import EnvironmentWarning from "./EnvironmentWarning";
import { ConnectivityWall } from "@/features/connectivity";
import "./globals.css";

export default function App() {
  useWindowDrag();
  useAppIconSync();

  return (
    <HashRouter>
      <CoverSwRegistrar />
      <ThemeProvider
        attribute="data-theme"
        defaultTheme="dark"
        enableSystem={false}
        disableTransitionOnChange
      >
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
