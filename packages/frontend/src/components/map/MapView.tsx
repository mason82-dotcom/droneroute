import { themedStreetStyle } from "@/lib/theme";
import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import Map, {
  Source,
  Layer,
  Popup,
  useMap,
  MapMouseEvent,
} from "react-map-gl/maplibre";
import type { LngLatBoundsLike, StyleSpecification } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import MaplibreGeocoder from "@maplibre/maplibre-gl-geocoder";
import "@/lib/maplibreSetup";
import "maplibre-gl/dist/maplibre-gl.css";
import "@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css";
import { buildSatelliteStyle, type BaseMapKey } from "@/lib/mapStyles";
import { photonGeocoder } from "@/lib/photonGeocoder";
import type { ElevatedLineCollection } from "@/lib/map3d";
import { ElevatedLines } from "./ElevatedLines";
import { useMissionStore } from "@/store/missionStore";
import { useConfigStore } from "@/store/configStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import { getObstacleWarnings } from "@/lib/geo";
import { WaypointMarker } from "./WaypointMarker";
import { PoiMarker } from "./PoiMarker";
import { MapToolbar } from "./MapToolbar";
import { TemplateDrawHandler } from "./TemplateDrawHandler";
import { PencilDrawHandler } from "./PencilDrawHandler";
import { ObstacleDrawHandler } from "./ObstacleDrawHandler";
import { ObstaclePolygon } from "./ObstaclePolygon";
import { AirspaceOverlay } from "./AirspaceOverlay";
import { CameraFrustum } from "./CameraFrustum";
import { Triangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

interface BuildingPopupData {
  lng: number;
  lat: number;
  height: number | null;
  vertices: [number, number][]; // [lat, lng][]
}

/** Sets up 3D buildings layer and syncs 2D/3D pitch/rotation. */
function SceneSetup({ is3D, styleKey }: { is3D: boolean; styleKey: string }) {
  const { current: map } = useMap();
  const buildingsTiles = useConfigStore((s) => s.mapSources.buildingsTiles);

  // Buildings layer (re-added on style changes)
  useEffect(() => {
    if (!map) return;

    const setup = () => {
      const m = map.getMap();
      if (!m.isStyleLoaded()) return;
      if (m.getLayer("3d-buildings")) return;

      const style = m.getStyle();
      const layers = style?.layers ?? [];

      // Hide the style's own extruded buildings; ours are clickable.
      for (const layer of layers) {
        if (
          layer.type === "fill-extrusion" &&
          (layer as { "source-layer"?: string })["source-layer"] === "building"
        ) {
          m.setLayoutProperty(layer.id, "visibility", "none");
        }
      }

      // OpenMapTiles-schema buildings (render_height / render_min_height)
      if (!m.getSource("buildings")) {
        m.addSource("buildings", { type: "vector", url: buildingsTiles });
      }

      const labelLayerId = layers.find(
        (layer) =>
          layer.type === "symbol" &&
          (layer as { layout?: Record<string, unknown> }).layout?.[
            "text-field"
          ],
      )?.id;

      m.addLayer(
        {
          id: "3d-buildings",
          source: "buildings",
          "source-layer": "building",
          type: "fill-extrusion",
          minzoom: 14,
          paint: {
            "fill-extrusion-color": "#aaa",
            "fill-extrusion-height": [
              "coalesce",
              ["get", "render_height"],
              ["get", "height"],
              5,
            ],
            "fill-extrusion-base": [
              "coalesce",
              ["get", "render_min_height"],
              ["get", "min_height"],
              0,
            ],
            "fill-extrusion-opacity": 0.5,
          },
        },
        labelLayerId,
      );
    };

    const m = map.getMap();
    // Retry setup: style may already be loaded or may load shortly
    if (m.isStyleLoaded()) setup();
    m.on("style.load", setup);
    // Also listen for styledata which fires more reliably with react-map-gl
    m.on("styledata", setup);
    return () => {
      m.off("style.load", setup);
      m.off("styledata", setup);
    };
  }, [map, styleKey, buildingsTiles]);

  // Terrain on in 3D, off in 2D. Managed here rather than through the
  // `terrain` prop: react-map-gl ignores an `undefined` prop, which would leave
  // terrain on in 2D and hide flat lines behind buildings. Re-applied after
  // style switches, once the DEM source is back.
  useEffect(() => {
    if (!map) return;
    const m = map.getMap();
    const apply = () => {
      if (!m.isStyleLoaded()) return;
      const wanted = is3D && m.getSource("terrain-dem");
      if (wanted && !m.getTerrain()) {
        m.setTerrain({ source: "terrain-dem", exaggeration: 1 });
      } else if (!wanted && m.getTerrain()) {
        m.setTerrain(null);
      }
    };
    apply();
    m.on("styledata", apply);
    m.on("sourcedata", apply);
    return () => {
      m.off("styledata", apply);
      m.off("sourcedata", apply);
    };
  }, [map, is3D]);

  // Toggle pitch/rotation when is3D changes
  useEffect(() => {
    if (!map) return;
    const m = map.getMap();

    if (is3D) {
      m.setMaxPitch(85);
      m.dragRotate.enable();
      m.easeTo({ pitch: 45, duration: 500 });
    } else {
      m.easeTo({ pitch: 0, duration: 500 });
      // Set maxPitch after animation to avoid clamping during easeTo
      setTimeout(() => {
        m.setMaxPitch(0);
        m.dragRotate.disable();
      }, 600);
    }
  }, [map, is3D]);

  return null;
}

/** Adds a geocoding search box to the map (top-left), backed by Photon. */
function GeocoderControl() {
  const { current: map } = useMap();
  const geocoderUrl = useConfigStore((s) => s.mapSources.geocoderUrl);
  const geocoderRef = useRef<MaplibreGeocoder | null>(null);

  useEffect(() => {
    if (!map || !geocoderUrl || geocoderRef.current) return;
    const m = map.getMap();

    const geocoder = new MaplibreGeocoder(photonGeocoder(geocoderUrl), {
      maplibregl,
      marker: false,
      collapsed: true,
      showResultsWhileTyping: true,
      trackProximity: true,
      minLength: 3,
      debounceSearch: 400,
      placeholder: "Search location...",
    });

    m.addControl(geocoder, "top-left");
    geocoderRef.current = geocoder;

    return () => {
      try {
        m.removeControl(geocoder);
      } catch {
        // DOM already detached — ignore
      }
      geocoderRef.current = null;
    };
  }, [map, geocoderUrl]);

  return null;
}

/**
 * Automatically fits the map to show all waypoints when a mission is loaded.
 * Triggers when waypoints go from 0 to N (N >= 2).
 */
function FitBoundsOnLoad() {
  const { current: map } = useMap();
  const waypoints = useMissionStore((s) => s.waypoints);
  const pois = useMissionStore((s) => s.pois);
  const obstacles = useMissionStore((s) => s.obstacles);
  const prevCountRef = useRef(0);

  useEffect(() => {
    const wasEmpty = prevCountRef.current === 0;
    prevCountRef.current = waypoints.length;
    if (!wasEmpty || waypoints.length < 2 || !map) return;

    const allPoints = [
      ...waypoints.map((wp) => [wp.longitude, wp.latitude] as [number, number]),
      ...pois.map((p) => [p.longitude, p.latitude] as [number, number]),
      ...obstacles.flatMap((o) =>
        o.vertices.map((v) => [v[1], v[0]] as [number, number]),
      ),
    ];

    if (allPoints.length === 0) return;

    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    for (const [lng, lat] of allPoints) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ] as LngLatBoundsLike,
      { padding: 50, maxZoom: 16 },
    );
  }, [waypoints, pois, obstacles, map]);

  return null;
}

/** GeoJSON source + layer for the flight path polyline segments (3D with altitude) */
function FlightPath({ is3D }: { is3D: boolean }) {
  const waypoints = useMissionStore((s) => s.waypoints);
  const obstacles = useMissionStore((s) => s.obstacles);

  const warnings = useMemo(
    () => getObstacleWarnings(waypoints, obstacles),
    [waypoints, obstacles],
  );

  const warningSegments = useMemo(() => {
    const set = new Set<number>();
    for (const w of warnings) {
      if (w.type === "crosses") set.add(w.waypointIndex);
    }
    return set;
  }, [warnings]);

  // 3D flight path segments (elevated)
  const geojson = useMemo(() => {
    if (waypoints.length < 2) return null;
    const features = waypoints.slice(0, -1).map((wp, i) => {
      const next = waypoints[i + 1];
      return {
        type: "Feature" as const,
        properties: {
          color: warningSegments.has(wp.index) ? "#ef4444" : "#3b82f6",
          zStart: wp.height,
          zEnd: next.height,
        },
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [wp.longitude, wp.latitude],
            [next.longitude, next.latitude],
          ],
        },
      };
    });
    return { type: "FeatureCollection" as const, features };
  }, [waypoints, warningSegments]);

  // Ground shadow path (single continuous line at ground level)
  const groundPathGeojson = useMemo(() => {
    if (waypoints.length < 2) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: waypoints.map((wp) => [wp.longitude, wp.latitude]),
      },
    };
  }, [waypoints]);

  if (!geojson) return null;

  return (
    <>
      {/* Ground shadow line (3D only) */}
      {is3D && groundPathGeojson && (
        <Source id="flight-path-ground" type="geojson" data={groundPathGeojson}>
          <Layer
            id="flight-path-ground-line"
            type="line"
            paint={{
              "line-color": "#94a3b8",
              "line-width": 1.5,
              "line-opacity": 0.3,
            }}
            layout={{
              "line-cap": "round",
              "line-join": "round",
            }}
          />
        </Source>
      )}

      {/* Flight path: dashed line in 2D (kept mounted so its layer order
          stays stable), elevated ribbon in 3D */}
      <Source id="flight-path" type="geojson" data={geojson}>
        <Layer
          id="flight-path-line"
          type="line"
          paint={{
            "line-color": ["get", "color"],
            "line-width": 3,
            "line-opacity": 0.9,
            "line-dasharray": [2, 1.2],
          }}
          layout={{
            "line-cap": "round",
            "line-join": "round",
            visibility: is3D ? "none" : "visible",
          }}
        />
      </Source>
      {is3D && (
        <ElevatedLines
          id="flight-path-3d"
          data={geojson as ElevatedLineCollection}
          widthPx={3}
          opacity={0.9}
        />
      )}
    </>
  );
}

/** Dotted lines from waypoints to their referenced POI */
function PoiPointingLines({ is3D }: { is3D: boolean }) {
  const waypoints = useMissionStore((s) => s.waypoints);
  const pois = useMissionStore((s) => s.pois);

  const geojson = useMemo(() => {
    const features: any[] = [];
    for (const wp of waypoints) {
      if (wp.headingMode === "towardPOI" && wp.poiId) {
        const poi = pois.find((p) => p.id === wp.poiId);
        if (poi) {
          features.push({
            type: "Feature",
            properties: {
              color: "#4ade80",
              width: 3,
              opacity: 0.8,
              zStart: wp.height,
              zEnd: poi.height,
            },
            geometry: {
              type: "LineString",
              coordinates: [
                [wp.longitude, wp.latitude],
                [poi.longitude, poi.latitude],
              ],
            },
          });
        }
      }
    }
    return { type: "FeatureCollection" as const, features };
  }, [waypoints, pois]);

  if (geojson.features.length === 0) return null;

  return (
    <>
      <Source id="poi-pointing-lines" type="geojson" data={geojson}>
        <Layer
          id="poi-pointing-lines-layer"
          type="line"
          paint={{
            "line-color": ["get", "color"],
            "line-width": ["get", "width"],
            "line-opacity": ["get", "opacity"],
          }}
          layout={{ visibility: is3D ? "none" : "visible" }}
        />
      </Source>
      {is3D && (
        <ElevatedLines
          id="poi-pointing-lines-3d"
          data={geojson as ElevatedLineCollection}
          widthPx={3}
          opacity={0.8}
        />
      )}
    </>
  );
}

export function MapView() {
  const mapSources = useConfigStore((s) => s.mapSources);
  const defaultMapView = useConfigStore((s) => s.defaultMapView);
  const waypoints = useMissionStore((s) => s.waypoints);
  const pois = useMissionStore((s) => s.pois);
  const obstacles = useMissionStore((s) => s.obstacles);
  const isAddingWaypoint = useMissionStore((s) => s.isAddingWaypoint);
  const isAddingPoi = useMissionStore((s) => s.isAddingPoi);
  const isDrawingObstacle = useMissionStore((s) => s.isDrawingObstacle);
  const templateMode = useMissionStore((s) => s.templateMode);
  const selectedWaypointIndices = useMissionStore(
    (s) => s.selectedWaypointIndices,
  );
  const addWaypoint = useMissionStore((s) => s.addWaypoint);
  const addPoi = useMissionStore((s) => s.addPoi);
  const addObstacle = useMissionStore((s) => s.addObstacle);
  const vizPrefs = usePreferencesStore((s) => s.preferences?.visualization);
  const [baseMap, setBaseMap] = useState<BaseMapKey>(
    vizPrefs?.mapStyle === "street" ? "street" : "satellite",
  );
  const [satelliteStyle, setSatelliteStyle] =
    useState<StyleSpecification | null>(null);

  // The satellite style combines imagery with the label layers of a vector
  // style, so it is assembled once the sources are known.
  useEffect(() => {
    let cancelled = false;
    buildSatelliteStyle(mapSources).then((style) => {
      if (!cancelled) setSatelliteStyle(style);
    });
    return () => {
      cancelled = true;
    };
  }, [mapSources]);

  const mapStyle: string | StyleSpecification | null =
    baseMap === "street"
      ? themedStreetStyle(mapSources.streetStyle)
      : baseMap === "extra" && mapSources.extraStyle
        ? mapSources.extraStyle.url
        : satelliteStyle;
  const overlay = mapSources.overlay;
  const [overlayOn, setOverlayOn] = useState(
    () => localStorage.getItem("droneroute_overlay") !== "off",
  );
  const toggleOverlay = () => {
    setOverlayOn((on) => {
      localStorage.setItem("droneroute_overlay", on ? "off" : "on");
      return !on;
    });
  };
  const [is3D, setIs3D] = useState(vizPrefs?.viewMode === "3d");
  const [buildingPopup, setBuildingPopup] = useState<BuildingPopupData | null>(
    null,
  );

  const cursorClass =
    templateMode === "pencil"
      ? "map-tool-pencil"
      : templateMode
        ? "map-tool-template"
        : isDrawingObstacle
          ? "map-tool-obstacle"
          : isAddingWaypoint
            ? "map-tool-waypoint"
            : isAddingPoi
              ? "map-tool-poi"
              : "";

  const handleClick = useCallback(
    (e: MapMouseEvent) => {
      if (templateMode || isDrawingObstacle) return;
      if (isAddingWaypoint) {
        addWaypoint(e.lngLat.lat, e.lngLat.lng);
        return;
      }
      if (isAddingPoi) {
        addPoi(e.lngLat.lat, e.lngLat.lng);
        return;
      }

      // Check if a 3D building was clicked
      const map = e.target as any;
      if (map.getLayer && map.getLayer("3d-buildings")) {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["3d-buildings"],
        });
        if (features && features.length > 0) {
          const feature = features[0];
          const geometry = feature.geometry;
          if (geometry.type === "Polygon" && geometry.coordinates?.[0]) {
            // Convert [lng, lat] → [lat, lng] for our obstacle format
            const ring = geometry.coordinates[0] as [number, number][];
            // Remove the closing duplicate vertex
            const vertices: [number, number][] = ring
              .slice(0, -1)
              .map(([lng, lat]) => [lat, lng] as [number, number]);

            if (vertices.length >= 3) {
              const height =
                feature.properties?.render_height ??
                feature.properties?.height ??
                null;
              setBuildingPopup({
                lng: e.lngLat.lng,
                lat: e.lngLat.lat,
                height: height ? Math.round(height) : null,
                vertices,
              });
              return;
            }
          }
        }
      }

      // Clicked elsewhere — dismiss popup
      setBuildingPopup(null);
    },
    [
      isAddingWaypoint,
      isAddingPoi,
      templateMode,
      isDrawingObstacle,
      addWaypoint,
      addPoi,
    ],
  );

  const cursor =
    templateMode || isDrawingObstacle || isAddingWaypoint || isAddingPoi
      ? "crosshair"
      : "grab";

  if (!mapStyle) {
    return (
      <div className="relative h-full w-full flex items-center justify-center bg-background text-muted-foreground">
        <p>{t("Loading map...")}</p>
      </div>
    );
  }

  const switchButton = (active: boolean) =>
    `px-2 py-1 text-xs rounded ${active ? "bg-primary text-primary-foreground" : "bg-background/90 text-foreground border border-border"}`;

  return (
    <div className={`relative h-full w-full ${cursorClass}`}>
      <Map
        initialViewState={{
          longitude: defaultMapView.longitude,
          latitude: defaultMapView.latitude,
          zoom: defaultMapView.zoom,
          pitch: 0,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        cursor={cursor}
        onClick={handleClick}
        doubleClickZoom={false}
        id="main-map"
        attributionControl={{ compact: true }}
        onLoad={(e) => {
          // Start with the attribution collapsed ("i" button) so it does not
          // cover the style switcher; it expands on click.
          const attrib = e.target
            .getContainer()
            .querySelector(".maplibregl-ctrl-attrib");
          attrib?.classList.remove("maplibregl-compact-show");
          attrib?.removeAttribute("open");
        }}
      >
        {/* DEM source — always present so terrain prop can reference it */}
        <Source
          id="terrain-dem"
          type="raster-dem"
          tiles={[mapSources.terrain.tiles]}
          encoding={mapSources.terrain.encoding}
          tileSize={mapSources.terrain.tileSize}
          maxzoom={mapSources.terrain.maxzoom}
          attribution={mapSources.terrain.attribution}
        />
        {overlay && overlayOn && (
          <Source
            id="map-overlay"
            type="raster"
            tiles={[overlay.tiles]}
            tileSize={overlay.tileSize}
            maxzoom={overlay.maxzoom}
            attribution={overlay.attribution}
            {...(overlay.bounds ? { bounds: overlay.bounds } : {})}
          >
            <Layer
              id="map-overlay"
              type="raster"
              paint={{ "raster-opacity": overlay.opacity }}
            />
          </Source>
        )}
        <FitBoundsOnLoad />
        <GeocoderControl />
        <SceneSetup is3D={is3D} styleKey={baseMap} />
        <FlightPath is3D={is3D} />
        <PoiPointingLines is3D={is3D} />
        <TemplateDrawHandler />
        <PencilDrawHandler />
        <ObstacleDrawHandler />
        <AirspaceOverlay />
        {obstacles.map((obstacle) => (
          <ObstaclePolygon key={obstacle.id} obstacle={obstacle} />
        ))}
        {waypoints.map((wp) => (
          <WaypointMarker key={wp.index} waypoint={wp} is3D={is3D} />
        ))}
        {selectedWaypointIndices.size === 1 &&
          (() => {
            const idx = [...selectedWaypointIndices][0];
            const wp = waypoints.find((w) => w.index === idx);
            return wp ? (
              <CameraFrustum waypoint={wp} pois={pois} is3D={is3D} />
            ) : null;
          })()}
        {pois.map((poi) => (
          <PoiMarker key={poi.id} poi={poi} is3D={is3D} />
        ))}

        {/* Building-to-obstacle popup */}
        {buildingPopup && (
          <Popup
            longitude={buildingPopup.lng}
            latitude={buildingPopup.lat}
            anchor="bottom"
            closeOnClick={false}
            onClose={() => setBuildingPopup(null)}
            className="building-popup"
          >
            <div className="flex flex-col gap-2 p-1 min-w-[160px]">
              <div className="text-xs text-zinc-300">
                <strong className="text-white">{t("Building")}</strong>
                {buildingPopup.height != null && (
                  <span className="ml-2 text-zinc-400">
                    {buildingPopup.height}m tall
                  </span>
                )}
              </div>
              <div className="text-[10px] text-zinc-500">
                {buildingPopup.vertices.length} vertices
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-1.5 h-7 text-xs"
                onClick={() => {
                  addObstacle(buildingPopup.vertices);
                  setBuildingPopup(null);
                }}
              >
                <Triangle className="h-3 w-3" />
                {t("Convert to obstacle")}
              </Button>
            </div>
          </Popup>
        )}
      </Map>

      {/* Style switcher + 2D/3D toggle */}
      <div className="absolute bottom-4 left-4 z-10 flex gap-1">
        <button
          className={switchButton(baseMap === "street")}
          onClick={() => setBaseMap("street")}
        >
          {t("Street")}
        </button>
        <button
          className={switchButton(baseMap === "satellite")}
          onClick={() => setBaseMap("satellite")}
        >
          {t("Satellite")}
        </button>
        {mapSources.extraStyle && (
          <button
            className={switchButton(baseMap === "extra")}
            onClick={() => setBaseMap("extra")}
          >
            {mapSources.extraStyle.name}
          </button>
        )}
        {overlay && (
          <>
            <div className="w-px bg-border mx-1" />
            <button
              className={switchButton(overlayOn)}
              onClick={toggleOverlay}
              aria-pressed={overlayOn}
              title={`${overlayOn ? "Hide" : "Show"} ${overlay.name}`}
            >
              {overlay.name}
            </button>
          </>
        )}
        <div className="w-px bg-border mx-1" />
        <button className={switchButton(!is3D)} onClick={() => setIs3D(false)}>
          2D
        </button>
        <button className={switchButton(is3D)} onClick={() => setIs3D(true)}>
          3D
        </button>
      </div>

      <MapToolbar />
    </div>
  );
}
