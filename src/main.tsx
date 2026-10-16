import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { RootErrorBoundary } from "@/shared/ui";
import { initGlobalErrorHandlers } from "@/shared/utils/globalErrorHandlers";
import { initTelemetry } from "@/shared/telemetry";
import { initBackgroundStorageAnalytics } from "@/shared/utils/cacheManager";
import { initApiEndpointProbe } from "@/shared/api";
import { initClientVisitorSession } from "@/shared/api/visitorSession";

// Initialize global uncaught error, telemetry listeners, background storage tracker, api health probe, and visitor session
initGlobalErrorHandlers();
initTelemetry();
initBackgroundStorageAnalytics();
initApiEndpointProbe();
initClientVisitorSession();

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </React.StrictMode>,
  );
}

