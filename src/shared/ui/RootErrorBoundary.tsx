import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { log } from "@/shared/utils/logger";
import { telemetry } from "@/shared/telemetry";
import RootErrorFallback from "./RootErrorFallback";

export interface FallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  resetErrorBoundary: () => void;
}

export interface RootErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: FallbackProps) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

interface RootErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class RootErrorBoundary extends Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  constructor(props: RootErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    log(
      "red",
      "RootErrorBoundary",
      `Uncaught React rendering error: ${error.message}`,
      error,
      errorInfo.componentStack,
    );

    this.props.onError?.(error, errorInfo);

    // Automatically send crash report with component stack to Monitor
    telemetry.reportError(error, {
      componentStack: errorInfo.componentStack,
      source: "React.RootErrorBoundary",
    }).catch(() => {});
  }

  resetErrorBoundary = (): void => {
    this.props.onReset?.();
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          resetErrorBoundary: this.resetErrorBoundary,
        });
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <RootErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.resetErrorBoundary}
        />
      );
    }

    return this.props.children;
  }
}

export default RootErrorBoundary;
