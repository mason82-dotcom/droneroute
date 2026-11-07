// Colour theme: light (default, matches FlightHub Keyless) or dark (original DroneRoute look).
// Set on <html data-theme> before the first render so there is no flash; switching reloads.
export type Theme = "light" | "dark";
const KEY = "droneroute.theme";

function read(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* storage unavailable */
  }
  return "light";
}

export const theme: Theme = typeof window === "undefined" ? "light" : read();
if (typeof document !== "undefined")
  document.documentElement.dataset.theme = theme;

export function setTheme(next: Theme): void {
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  window.location.reload();
}

/** The configured street style is dark (OpenFreeMap "dark"); the light theme uses its light sibling. */
export function themedStreetStyle(url: string): string {
  return theme === "light"
    ? url.replace(/\/styles\/dark(\b|$)/, "/styles/positron")
    : url;
}
