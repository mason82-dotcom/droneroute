## Summary

Orthomosaic overlap mode for grid surveys (fixes #40).

## Changes

- Camera profiles (sensor size, focal length, resolution) for the wide/mapping
  camera of each payload in `DRONE_MODELS`; `findMissionModel()` and
  `computeOrthoPlan()` in the shared package.
- Grid survey panel: "Orthomosaic mode" with front and side overlap in percent.
  The line spacing is computed from the camera footprint, and photo waypoints
  are placed along every pass so the front overlap is met.
- The pilot has to confirm the mission drone and payload whose camera profile
  is used before the grid can be applied. Without a camera profile the mode
  explains how to pick a supported payload.
- The panel shows photo spacing, ground resolution (cm/px) and the estimated
  photo count.
- Warning in EGM96 height mode, where the altitude is not the height above
  ground. Apply is blocked when the mission would exceed 5000 waypoints (the
  backend limit, now shared as `MAX_MISSION_WAYPOINTS`).
- The ground resolution of 48 MP quad-Bayer cameras uses the default 12 MP
  photo size.
- Orthomosaic mode, overlaps and the confirmed model are kept for the next grid
  while the template tool is open.
- The template preview draws waypoints as one map layer instead of a DOM marker
  each, so large grids stay responsive.
- Frontend unit tests (vitest) for the overlap math and the grid generator.
- Screenshots: `docs/screenshots/ortho-before.png`, `ortho-after.png`.
