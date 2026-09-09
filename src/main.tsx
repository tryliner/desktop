import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { RootErrorBoundary } from "@/shared/ui";
import { initGlobalErrorHandlers } from "@/shared/utils/globalErrorHandlers";
import { initTelemetry } from "@/shared/telemetry";

// Initialize global uncaught error and telemetry listeners
initGlobalErrorHandlers();
initTelemetry();

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

