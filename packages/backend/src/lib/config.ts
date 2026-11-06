import {
  DEFAULT_MAP_SOURCES,
  DEFAULT_MAP_VIEW,
  type MapSourcesConfig,
  type MapViewState,
  type RasterLayerConfig,
} from "@droneroute/shared";

function inRange(n: number, min: number, max: number): boolean {
  return Number.isFinite(n) && n >= min && n <= max;
}

/**
 * Resolve the default map view (center + zoom) shown when the app first loads.
 *
 * Self-hosted instances can override it via the DEFAULT_MAP_VIEW environment
 * variable, formatted as "lat,lng" or "lat,lng,zoom" (e.g. "51.5072,-0.1276,12").
 * Zoom is optional and defaults to the built-in zoom. The whole value falls back
 * to the built-in default when unset or any part is missing, non-numeric, or out
 * of range.
 */
export function resolveDefaultMapView(
  env: NodeJS.ProcessEnv = process.env,
): MapViewState {
  const raw = env.DEFAULT_MAP_VIEW;
  if (raw === undefined || raw.trim() === "") return DEFAULT_MAP_VIEW;

  const parts = raw.split(",").map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => p === "")) {
    return DEFAULT_MAP_VIEW;
  }

  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  const zoom = parts.length === 3 ? Number(parts[2]) : DEFAULT_MAP_VIEW.zoom;

  if (
    !inRange(latitude, -90, 90) ||
    !inRange(longitude, -180, 180) ||
    !inRange(zoom, 0, 22)
  ) {
    return DEFAULT_MAP_VIEW;
  }

  return { latitude, longitude, zoom };
}

/** Returns the trimmed value when it is an http(s) URL, otherwise undefined. */
function httpUrl(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value.replace(/[{}]/g, ""));
    return url.protocol === "https:" || url.protocol === "http:"
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

function text(raw: string | undefined, fallback: string): string {
  const value = raw?.trim();
  return value ? value : fallback;
}

function intInRange(
  raw: string | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = Number(raw);
  return raw?.trim() && Number.isInteger(n) && n >= min && n <= max
    ? n
    : fallback;
}

/** Parses "west,south,east,north"; undefined when unset or invalid. */
function bounds(
  raw: string | undefined,
): [number, number, number, number] | undefined {
  if (!raw?.trim()) return undefined;
  const parts = raw.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 4) return undefined;
  const [w, s, e, n] = parts;
  if (
    !inRange(w, -180, 180) ||
    !inRange(e, -180, 180) ||
    !inRange(s, -90, 90) ||
    !inRange(n, -90, 90) ||
    w >= e ||
    s >= n
  ) {
    return undefined;
  }
  return [w, s, e, n];
}

/**
 * Resolve the map data sources. The defaults need no API key; every source can
 * be replaced through MAP_* environment variables (see .env.example). Invalid
 * values fall back to the default instead of breaking the map.
 */
export function resolveMapSources(
  env: NodeJS.ProcessEnv = process.env,
): MapSourcesConfig {
  const d = DEFAULT_MAP_SOURCES;

  const imagery: RasterLayerConfig = {
    tiles: httpUrl(env.MAP_IMAGERY_TILES) ?? d.imagery.tiles,
    attribution: text(env.MAP_IMAGERY_ATTRIBUTION, d.imagery.attribution),
    tileSize: intInRange(env.MAP_IMAGERY_TILE_SIZE, 64, 1024, 256),
    maxzoom: intInRange(env.MAP_IMAGERY_MAXZOOM, 1, 24, d.imagery.maxzoom),
  };

  const orthophotoTiles = httpUrl(env.MAP_ORTHOPHOTO_TILES);
  const orthophoto: RasterLayerConfig | null = orthophotoTiles
    ? {
        tiles: orthophotoTiles,
        attribution: text(env.MAP_ORTHOPHOTO_ATTRIBUTION, ""),
        bounds: bounds(env.MAP_ORTHOPHOTO_BOUNDS),
        tileSize: intInRange(env.MAP_ORTHOPHOTO_TILE_SIZE, 64, 1024, 256),
        maxzoom: intInRange(env.MAP_ORTHOPHOTO_MAXZOOM, 1, 24, 22),
      }
    : null;

  const extraUrl = httpUrl(env.MAP_EXTRA_STYLE_URL);
  const extraStyle = extraUrl
    ? { name: text(env.MAP_EXTRA_STYLE_NAME, "Map"), url: extraUrl }
    : null;

  const encoding =
    env.MAP_TERRAIN_ENCODING?.trim() === "mapbox" ? "mapbox" : "terrarium";
  const terrainTiles = httpUrl(env.MAP_TERRAIN_TILES);

  const geocoderRaw = env.MAP_GEOCODER_URL?.trim();
  const geocoderUrl =
    geocoderRaw === "off" ? null : (httpUrl(geocoderRaw) ?? d.geocoderUrl);

  return {
    streetStyle: httpUrl(env.MAP_STREET_STYLE) ?? d.streetStyle,
    labelsStyle: httpUrl(env.MAP_LABELS_STYLE) ?? d.labelsStyle,
    buildingsTiles: httpUrl(env.MAP_BUILDINGS_TILES) ?? d.buildingsTiles,
    imagery,
    orthophoto,
    extraStyle,
    terrain: terrainTiles
      ? {
          tiles: terrainTiles,
          encoding,
          attribution: text(env.MAP_TERRAIN_ATTRIBUTION, ""),
          tileSize: intInRange(env.MAP_TERRAIN_TILE_SIZE, 64, 1024, 256),
          maxzoom: intInRange(env.MAP_TERRAIN_MAXZOOM, 1, 22, 14),
        }
      : d.terrain,
    geocoderUrl,
  };
}
