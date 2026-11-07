## Summary

New missions use "relative to start" as height reference.

## Changes

- Default height reference changed from above ground level to relative to the takeoff point. DJI documents
  `aboveGroundLevel` as supported by FlightHub 2 only; DJI Pilot 2 needs `relativeToStartPoint` or `EGM96`.
- Saved missions and your own mission defaults keep their setting; the DJI check still warns about above ground level.
