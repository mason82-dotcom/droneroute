## Summary

Light theme (default) aligned with FlightHub Keyless; the dark theme stays selectable.

## Changes

- Semantic colours now come from theme variables; `data-theme` on `<html>` is set before the first render.
- Light theme: Tailwind gray neutrals, accent `#1f5fbf`, white cards; accent text shades
  (`*-300/400`) are mapped to darker steps so section headers and hints meet WCAG AA.
- Map popups, geocoder, keyboard hints and toasts follow the theme; the street map uses the light
  OpenFreeMap style in the light theme.
- Settings: theme (light/dark); German labels for unit-based fields; shorter German import/export buttons.
