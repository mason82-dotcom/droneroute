import { useEffect, useMemo, useState } from "react";
import { Source, Layer, useMap } from "react-map-gl/maplibre";
import {
  elevatedRibbons,
  metersPerPixel,
  type ElevatedLineCollection,
} from "@/lib/map3d";

interface ElevatedLinesProps {
  id: string;
  data: ElevatedLineCollection;
  /** Approximate on-screen width in pixels. */
  widthPx: number;
  opacity: number;
}

/**
 * Draws line segments at their heights above ground in 3D view, replacing
 * Mapbox's `line-z-offset`. The ribbon width follows the zoom level so the
 * lines keep roughly the same on-screen width.
 */
export function ElevatedLines({
  id,
  data,
  widthPx,
  opacity,
}: ElevatedLinesProps) {
  const { current: mapRef } = useMap();
  const [zoom, setZoom] = useState(() => Math.round(mapRef?.getZoom() ?? 15));

  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();
    const update = () => setZoom(Math.round(map.getZoom()));
    map.on("zoomend", update);
    return () => {
      map.off("zoomend", update);
    };
  }, [mapRef]);

  const ribbons = useMemo(() => {
    const first = data.features[0]?.geometry.coordinates[0];
    const lat = first ? first[1] : 0;
    return elevatedRibbons(data, widthPx * metersPerPixel(lat, zoom));
  }, [data, widthPx, zoom]);

  return (
    <Source id={id} type="geojson" data={ribbons}>
      <Layer
        id={`${id}-layer`}
        type="fill-extrusion"
        paint={{
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-base": ["get", "base"],
          "fill-extrusion-height": ["get", "top"],
          "fill-extrusion-opacity": opacity,
        }}
      />
    </Source>
  );
}
