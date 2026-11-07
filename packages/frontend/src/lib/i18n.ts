// Minimal UI translation: English source strings are the keys, so untranslated text simply stays
// English and the fork remains mergeable with upstream. Language: ?lang=de|en (remembered), else the
// browser language (German → de). Read once at start; switching reloads the page.
import { de } from "./i18n.de";

export type Language = "de" | "en";
const KEY = "droneroute.lang";

function detect(): Language {
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q === "de" || q === "en") {
      localStorage.setItem(KEY, q);
      return q;
    }
    const saved = localStorage.getItem(KEY);
    if (saved === "de" || saved === "en") return saved;
  } catch {
    /* storage unavailable */
  }
  return typeof navigator !== "undefined" &&
    /^de\b/i.test(navigator.language || "")
    ? "de"
    : "en";
}

export const language: Language =
  typeof window === "undefined" ? "en" : detect();
if (typeof document !== "undefined") document.documentElement.lang = language;

/** Translate an English UI string; `{name}` placeholders are filled from `vars`. */
export function t(
  text: string,
  vars?: Record<string, string | number>,
): string {
  const out = (language === "de" && de[text]) || text;
  return vars
    ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
    : out;
}

export function setLanguage(lang: Language): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* ignore */
  }
  window.location.reload();
}
