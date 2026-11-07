## Summary

Missions are checked against the DJI WPML reference, and thermal drones can choose their lenses.

## Changes

- New "DJI check" section: validates value ranges and allowed values of all exported fields
  (takeoff height 1.2–1500 m, transitional speed ≤ 15 m/s, heading −180…180°, hover time > 0,
  focus 0…1, turn damping distance shorter than the segment, payload belongs to the drone, …).
  Errors block the KMZ export (also on the server, HTTP 422); warnings are only shown.
- Warning for height reference "above ground level": DJI documents it as FlightHub 2 only.
- `waylines.wpml` now contains `wpml:executeHeightMode` for routes relative to the takeoff point
  (required by DJI).
- Photo and video lenses for thermal payloads: `wpml:payloadParam/imageFormat` in the template and
  `useGlobalPayloadLensIndex`/`payloadLensIndex` per photo/video action, as written by DJI Pilot 2
  (values `visable`, `ir`, `visable,ir`); KMZ import reads the selection.
