## Summary

Replace Mapbox GL with MapLibre GL so the map works without a Mapbox account or
access token, using free and open map data by default.

## Changes

- Switch the frontend from `mapbox-gl` to `maplibre-gl` 6 (`react-map-gl/maplibre`)
  and from the Mapbox geocoder to `@maplibre/maplibre-gl-geocoder` backed by Photon
- Default sources without API keys: OpenFreeMap (street style, labels, 3D buildings),
  Esri World Imagery with OpenFreeMap labels (satellite), Mapterhorn (terrain DEM)
- Serve the map sources from `/api/config` (`mapSources`) instead of `mapboxToken`;
  every source is configurable through `MAP_*` environment variables, invalid values
  fall back to the defaults
- Optional regional orthophotos over the imagery (XYZ or WMS, with bounds) and an
  optional extra base map in the style switcher
- Recreate the 3D view without Mapbox-only features: markers are lifted by their
  projected height, and elevated flight path, POI lines, and camera frustum are drawn
  as thin fill-extrusion ribbons instead of `line-z-offset` lines
- Switch terrain off again when leaving 3D (previously it stayed on in 2D and could
  hide parts of the flight path behind buildings)
- Remove `MAPBOX_TOKEN`; document the `MAP_*` variables in `.env.example`, the map
  and privacy specs, and the privacy policy
