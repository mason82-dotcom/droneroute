import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useMap } from "react-map-gl/maplibre";
import { Marker } from "maplibre-gl";
import { altitudeScreenOffset } from "@/lib/map3d";

interface Marker3DProps {
  longitude: number;
  latitude: number;
  /** Altitude in meters above ground level (AGL), shown by shifting the marker on screen. */
  altitude?: number;
  anchor?: "center" | "top" | "bottom" | "left" | "right";
  draggable?: boolean;
  onDragStart?: () => void;
  onDrag?: (e: { lngLat: { lng: number; lat: number } }) => void;
  onDragEnd?: (e: { lngLat: { lng: number; lat: number } }) => void;
  children: React.ReactNode;
}

/**
 * A Marker component that supports 3D altitude positioning above ground.
 * MapLibre markers sit on the terrain surface; the altitude is added as a
 * screen offset computed from the camera, updated on every camera move.
 */
export function Marker3D({
  longitude,
  latitude,
  altitude = 0,
  anchor = "center",
  draggable = false,
  onDragStart,
  onDrag,
  onDragEnd,
  children,
}: Marker3DProps) {
  const { current: mapRef } = useMap();
  const markerRef = useRef<Marker | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callbacksRef = useRef({ onDragStart, onDrag, onDragEnd });
  callbacksRef.current = { onDragStart, onDrag, onDragEnd };
  const altitudeRef = useRef(altitude);
  altitudeRef.current = altitude;

  // Create the marker container element once
  if (!containerRef.current) {
    containerRef.current = document.createElement("div");
  }

  // Create the marker
  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();

    const el = containerRef.current!;
    const marker = new Marker({
      element: el,
      anchor,
      draggable,
    });

    marker.setLngLat([longitude, latitude]);
    marker.addTo(map);
    markerRef.current = marker;

    const applyAltitude = () => {
      const { lng, lat } = marker.getLngLat();
      marker.setOffset(
        altitudeScreenOffset(map, lng, lat, altitudeRef.current),
      );
    };
    applyAltitude();
    map.on("move", applyAltitude);
    map.on("idle", applyAltitude);

    // Attach drag event handlers
    if (draggable) {
      marker.on("dragstart", () => {
        callbacksRef.current.onDragStart?.();
      });
      marker.on("drag", () => {
        const lngLat = marker.getLngLat();
        callbacksRef.current.onDrag?.({
          lngLat: { lng: lngLat.lng, lat: lngLat.lat },
        });
      });
      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        callbacksRef.current.onDragEnd?.({
          lngLat: { lng: lngLat.lng, lat: lngLat.lat },
        });
      });
    }

    return () => {
      map.off("move", applyAltitude);
      map.off("idle", applyAltitude);
      marker.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, draggable, anchor]);

  // Update position when coordinates/altitude change
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLngLat([longitude, latitude]);
      if (mapRef) {
        markerRef.current.setOffset(
          altitudeScreenOffset(mapRef.getMap(), longitude, latitude, altitude),
        );
      }
    }
  }, [mapRef, longitude, latitude, altitude]);

  return containerRef.current
    ? createPortal(children, containerRef.current)
    : null;
}
