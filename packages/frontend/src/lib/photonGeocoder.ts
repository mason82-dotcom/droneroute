import type {
  MaplibreGeocoderApi,
  MaplibreGeocoderApiConfig,
  MaplibreGeocoderFeatureResults,
} from "@maplibre/maplibre-gl-geocoder";

interface PhotonFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    state?: string;
    country?: string;
    type?: string;
    /** [minLon, maxLat, maxLon, minLat] */
    extent?: [number, number, number, number];
  };
}

/** Languages Photon can answer in; anything else uses local names. */
const PHOTON_LANGUAGES = new Set(["de", "en", "fr"]);

function placeName(p: PhotonFeature["properties"]): string {
  const street = [p.street, p.housenumber].filter(Boolean).join(" ");
  const place = [p.postcode, p.city].filter(Boolean).join(" ");
  const parts = [p.name, street, place, p.state, p.country].filter(
    (v, i, all) => v && all.indexOf(v) === i,
  );
  return parts.join(", ");
}

/**
 * Geocoder API for @maplibre/maplibre-gl-geocoder backed by a Photon
 * (OpenStreetMap) search endpoint. No API key is needed.
 */
export function photonGeocoder(endpoint: string): MaplibreGeocoderApi {
  return {
    forwardGeocode: async (
      config: MaplibreGeocoderApiConfig,
    ): Promise<MaplibreGeocoderFeatureResults> => {
      const query = typeof config.query === "string" ? config.query : "";
      const empty = { type: "FeatureCollection" as const, features: [] };
      if (query.trim().length < 2) return empty;

      const url = new URL(endpoint);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", String(config.limit ?? 5));
      const lang = navigator.language?.slice(0, 2).toLowerCase();
      if (lang && PHOTON_LANGUAGES.has(lang)) {
        url.searchParams.set("lang", lang);
      }
      if (Array.isArray(config.proximity)) {
        // Prefer results near the map center (Photon location bias)
        url.searchParams.set("lon", String(config.proximity[0]));
        url.searchParams.set("lat", String(config.proximity[1]));
        url.searchParams.set("zoom", "12");
        url.searchParams.set("location_bias_scale", "0.2");
      }

      try {
        const res = await fetch(url);
        if (!res.ok) return empty;
        const data = (await res.json()) as { features?: PhotonFeature[] };
        return {
          type: "FeatureCollection",
          features: (data.features ?? []).map((f) => {
            const name = placeName(f.properties);
            const e = f.properties.extent;
            return {
              type: "Feature",
              geometry: f.geometry,
              properties: f.properties,
              place_name: name,
              text: f.properties.name ?? name,
              place_type: [f.properties.type ?? "place"],
              center: f.geometry.coordinates,
              ...(e ? { bbox: [e[0], e[3], e[2], e[1]] } : {}),
            };
          }),
        } as MaplibreGeocoderFeatureResults;
      } catch {
        return empty;
      }
    },
  };
}
