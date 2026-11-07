import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { AppWrapper } from "./AppWrapper";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import { theme } from "./lib/theme";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppWrapper />
    </ErrorBoundary>
    <Toaster theme={theme} position="bottom-center" richColors />
  </StrictMode>,
);
