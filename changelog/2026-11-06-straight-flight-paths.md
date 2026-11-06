## Summary

Straight segments stay straight in DJI Fly and DJI Pilot 2 (fixes #74).

## Changes

- Export `wpml:useStraightLine` for every waypoint (template.kml and
  waylines.wpml) and `wpml:globalUseStraightLine` in the template. DJI requires
  it for the `toPointAndStopWithContinuityCurvature` and
  `toPointAndPassWithContinuityCurvature` turn modes and treats segments as
  curved when it is missing; grid, facade and pencil templates use these modes.
- New per-waypoint option "Segment to next WP" (straight line / curved) for the
  curve turn modes; straight is the default, orbits use curved segments.
- KMZ import reads `useStraightLine`.
