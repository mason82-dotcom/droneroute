import type {
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from "maplibre-gl";
import type { MapSourcesConfig, RasterLayerConfig } from "@droneroute/shared";

/** Base map choices offered by the style switcher. */
export type BaseMapKey = "street" | "satellite" | "extra";

function rasterSource(layer: RasterLayerConfig): SourceSpecification {
  return {
    type: "raster",
    tiles: [layer.tiles],
    tileSize: layer.tileSize,
    maxzoom: layer.maxzoom,
    attribution: layer.attribution,
    ...(layer.bounds ? { bounds: layer.bounds } : {}),
  };
}

/** Imagery (plus optional orthophotos) without labels. */
function imageryOnly(sources: MapSourcesConfig): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    sources: { imagery: rasterSource(sources.imagery) },
    layers: [{ id: "imagery", type: "raster", source: "imagery" }],
  };
  if (sources.orthophoto) {
    style.sources.orthophoto = rasterSource(sources.orthophoto);
    style.layers.push({
      id: "orthophoto",
      type: "raster",
      source: "orthophoto",
    });
  }
  return style;
}

const labelsCache = new Map<string, Promise<StyleSpecification | null>>();

function fetchStyle(url: string): Promise<StyleSpecification | null> {
  let pending = labelsCache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<StyleSpecification>) : null))
      .catch(() => null);
    labelsCache.set(url, pending);
  }
  return pending;
}

/**
 * Satellite style: imagery, optional orthophotos, and the label layers of
 * `labelsStyle` on top (place, road and POI names), similar to a
 * "satellite-streets" style. Falls back to imagery only when the label style
 * cannot be loaded.
 */
export async function buildSatelliteStyle(
  sources: MapSourcesConfig,
): Promise<StyleSpecification> {
  const style = imageryOnly(sources);
  const labels = await fetchStyle(sources.labelsStyle);
  if (!labels) return style;

  const labelLayers = labels.layers.filter(
    (l): l is Extract<LayerSpecification, { type: "symbol" }> =>
      l.type === "symbol",
  );
  for (const layer of labelLayers) {
    const id = layer.source;
    if (!style.sources[id] && labels.sources[id]) {
      style.sources[id] = labels.sources[id];
    }
    style.layers.push(layer);
  }
  if (labels.glyphs) style.glyphs = labels.glyphs;
  if (labels.sprite) style.sprite = labels.sprite;
  return style;
}
