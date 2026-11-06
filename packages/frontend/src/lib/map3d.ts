import { MercatorCoordinate } from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * MapLibre has no Marker altitude and no `line-z-offset` (both are Mapbox GL v3
 * features). These helpers recreate the 3D look: markers are shifted on screen
 * by the projected height, and elevated lines are drawn as thin
 * fill-extrusion ribbons.
 */

interface MercatorTransformInternals {
  coordinatePoint?: (
    coord: MercatorCoordinate,
    elevation: number,
    pixelMatrix: ArrayLike<number>,
  ) => { x: number; y: number };
  _pixelMatrix3D?: ArrayLike<number>;
}

/** Ground elevation used by MapLibre for markers (0 without terrain). */
export function groundElevation(
  map: MapLibreMap,
  lng: number,
  lat: number,
): number {
  return map.queryTerrainElevation([lng, lat]) ?? 0;
}

/**
 * Screen offset in pixels of a point `heightAgl` meters above the ground,
 * relative to the same point on the ground. Uses the transform's 3D pixel
 * matrix (the one MapLibre uses to place markers on terrain); returns [0, 0]
 * when it is unavailable, e.g. under globe projection.
 */
export function altitudeScreenOffset(
  map: MapLibreMap,
  lng: number,
  lat: number,
  heightAgl: number,
): [number, number] {
  if (!heightAgl) return [0, 0];
  // The camera transform is internal; MapLibre 6 keeps it on `_camera`.
  const internals = map as unknown as {
    transform?: MercatorTransformInternals;
    _camera?: { transform?: MercatorTransformInternals };
  };
  const t = internals.transform ?? internals._camera?.transform;
  if (!t || typeof t.coordinatePoint !== "function" || !t._pixelMatrix3D) {
    return [0, 0];
  }
  const coord = MercatorCoordinate.fromLngLat([lng, lat]);
  const ground = groundElevation(map, lng, lat);
  const base = t.coordinatePoint(coord, ground, t._pixelMatrix3D);
  const top = t.coordinatePoint(coord, ground + heightAgl, t._pixelMatrix3D);
  if (![base.x, base.y, top.x, top.y].every(Number.isFinite)) return [0, 0];
  return [top.x - base.x, top.y - base.y];
}

/** Meters per screen pixel at a latitude and zoom (512 px tiles). */
export function metersPerPixel(lat: number, zoom: number): number {
  return (
    (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * Math.pow(2, zoom))
  );
}

export interface ElevatedLineProperties {
  zStart: number;
  zEnd: number;
  color?: string;
}

export type ElevatedLineCollection = GeoJSON.FeatureCollection<
  GeoJSON.LineString,
  ElevatedLineProperties
>;

/**
 * Converts 2-point line segments with start/end heights (meters above ground)
 * into polygons for a fill-extrusion layer: a ribbon `widthM` wide and
 * `widthM` thick. Sloped segments are split into steps so the ribbon follows
 * the height change.
 */
export function elevatedRibbons(
  lines: ElevatedLineCollection,
  widthM: number,
): GeoJSON.FeatureCollection<
  GeoJSON.Polygon,
  { base: number; top: number; color: string }
> {
  const features: GeoJSON.Feature<
    GeoJSON.Polygon,
    { base: number; top: number; color: string }
  >[] = [];
  const half = widthM / 2;

  for (const line of lines.features) {
    const coords = line.geometry.coordinates;
    if (coords.length < 2) continue;
    const [lng1, lat1] = coords[0];
    const [lng2, lat2] = coords[coords.length - 1];
    const { zStart, zEnd } = line.properties;
    const color = line.properties.color ?? "#3b82f6";

    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos((lat1 * Math.PI) / 180);
    const dx = (lng2 - lng1) * mPerDegLng;
    const dy = (lat2 - lat1) * mPerDegLat;
    const length = Math.hypot(dx, dy);
    // Perpendicular unit vector in meters, converted back to degrees
    const px = length > 0 ? -dy / length : 1;
    const py = length > 0 ? dx / length : 0;
    const offLng = (px * half) / mPerDegLng;
    const offLat = (py * half) / mPerDegLat;

    const steps = Math.max(
      1,
      Math.min(48, Math.ceil(Math.abs(zEnd - zStart) / Math.max(widthM, 1))),
    );
    for (let i = 0; i < steps; i++) {
      const a = i / steps;
      const b = (i + 1) / steps;
      const aLng = lng1 + (lng2 - lng1) * a;
      const aLat = lat1 + (lat2 - lat1) * a;
      const bLng = lng1 + (lng2 - lng1) * b;
      const bLat = lat1 + (lat2 - lat1) * b;
      const z = zStart + (zEnd - zStart) * ((a + b) / 2);
      features.push({
        type: "Feature",
        properties: { base: Math.max(0, z - half), top: z + half, color },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [aLng + offLng, aLat + offLat],
              [bLng + offLng, bLat + offLat],
              [bLng - offLng, bLat - offLat],
              [aLng - offLng, aLat - offLat],
              [aLng + offLng, aLat + offLat],
            ],
          ],
        },
      });
    }
  }
  return { type: "FeatureCollection", features };
}
