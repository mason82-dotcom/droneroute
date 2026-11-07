import { Component, type ErrorInfo, type ReactNode } from "react";
import { t } from "@/lib/i18n";

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render errors so a single failing component shows a message with a
 * reload button instead of unmounting the whole app (blank screen).
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("DroneRoute crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
        <h1 className="text-lg font-semibold">{t("Something went wrong")}</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          An unexpected error stopped the app. Reload to continue; details are
          in the browser console.
        </p>
        <button
          className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          onClick={() => window.location.reload()}
        >
          {t("Reload")}
        </button>
      </div>
    );
  }
}
