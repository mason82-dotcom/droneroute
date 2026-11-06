import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { AppWrapper } from "./AppWrapper";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppWrapper />
    </ErrorBoundary>
    <Toaster theme="dark" position="bottom-center" richColors />
  </StrictMode>,
);
