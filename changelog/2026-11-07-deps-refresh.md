## Summary

Dependencies refreshed; `npm audit` reports no vulnerabilities.

## Changes

- All dependencies updated within their semver ranges (React 19.3, Radix, Tailwind 4.3.5, Express 5.3,
  Helmet 8.3, Lucide, Vite plugin, tsx, …); lockfile written with npm 12.
- KMZ export now uses JSZip (already used by the importer) instead of `archiver`; the KMZ layout is
  unchanged. This removes the moderate `glob`/`minimatch`/`readdir-glob` advisories that `archiver` 7 and 8 pull in.
- Major updates left for a separate change: TypeScript 7, better-sqlite3 13, google-auth-library 11, chalk 6.
