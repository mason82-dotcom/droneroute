import { useMemo } from "react";
import { Layer, Marker, Source } from "react-map-gl/maplibre";
import type { TemplateResult } from "@/lib/templates";

interface TemplatePreviewProps {
  result: TemplateResult;
}

export function TemplatePreview({ result }: TemplatePreviewProps) {
  const { waypoints, pois } = result;

  // One GeoJSON layer instead of a DOM marker per waypoint: orthomosaic
  // grids can preview thousands of photo points.
  const waypointData = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: waypoints.map((wp) => ({
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "Point" as const,
          coordinates: [wp.longitude, wp.latitude],
        },
      })),
    }),
    [waypoints],
  );

  return (
    <>
      {/* Waypoint markers */}
      <Source id="template-preview-wps" type="geojson" data={waypointData}>
        <Layer
          id="template-preview-wps-layer"
          type="circle"
          paint={{
            "circle-radius": 5,
            "circle-color": "#c4b5fd",
            "circle-stroke-color": "#a78bfa",
            "circle-stroke-width": 2,
            "circle-opacity": 0.8,
            "circle-stroke-opacity": 0.8,
          }}
        />
      </Source>

      {/* POI markers */}
      {pois.map((poi, i) => (
        <Marker
          key={`preview-poi-${i}`}
          longitude={poi.longitude}
          latitude={poi.latitude}
          anchor="center"
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#fbbf24",
              border: "2px solid #f59e0b",
              opacity: 0.8,
            }}
          />
        </Marker>
      ))}
    </>
  );
}
