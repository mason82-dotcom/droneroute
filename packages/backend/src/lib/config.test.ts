import { describe, it, expect } from "vitest";
import { DEFAULT_MAP_SOURCES, DEFAULT_MAP_VIEW } from "@droneroute/shared";
import {
  isTrustedAddress,
  resolveDefaultMapView,
  resolveMapSources,
  resolveTrustedNetworks,
} from "./config.js";

describe("resolveDefaultMapView", () => {
  it("returns the built-in default when DEFAULT_MAP_VIEW is unset", () => {
    expect(resolveDefaultMapView({})).toEqual(DEFAULT_MAP_VIEW);
  });

  it("returns the built-in default when DEFAULT_MAP_VIEW is empty", () => {
    expect(resolveDefaultMapView({ DEFAULT_MAP_VIEW: "  " })).toEqual(
      DEFAULT_MAP_VIEW,
    );
  });

  it("parses lat,lng,zoom", () => {
    expect(
      resolveDefaultMapView({ DEFAULT_MAP_VIEW: "51.5072,-0.1276,10" }),
    ).toEqual({ latitude: 51.5072, longitude: -0.1276, zoom: 10 });
  });

  it("defaults the zoom when only lat,lng is given", () => {
    expect(
      resolveDefaultMapView({ DEFAULT_MAP_VIEW: "51.5072, -0.1276" }),
    ).toEqual({
      latitude: 51.5072,
      longitude: -0.1276,
      zoom: DEFAULT_MAP_VIEW.zoom,
    });
  });

  it("falls back when the value has too many or too few parts", () => {
    expect(resolveDefaultMapView({ DEFAULT_MAP_VIEW: "41" })).toEqual(
      DEFAULT_MAP_VIEW,
    );
    expect(
      resolveDefaultMapView({ DEFAULT_MAP_VIEW: "41,2,13,extra" }),
    ).toEqual(DEFAULT_MAP_VIEW);
  });

  it("falls back when a part is empty or non-numeric", () => {
    expect(resolveDefaultMapView({ DEFAULT_MAP_VIEW: "41,,13" })).toEqual(
      DEFAULT_MAP_VIEW,
    );
    expect(resolveDefaultMapView({ DEFAULT_MAP_VIEW: "north,2,13" })).toEqual(
      DEFAULT_MAP_VIEW,
    );
  });

  it("falls back when any value is out of range", () => {
    expect(resolveDefaultMapView({ DEFAULT_MAP_VIEW: "91,2,13" })).toEqual(
      DEFAULT_MAP_VIEW,
    ); // latitude > 90
    expect(resolveDefaultMapView({ DEFAULT_MAP_VIEW: "41,-200,13" })).toEqual(
      DEFAULT_MAP_VIEW,
    ); // longitude < -180
    expect(resolveDefaultMapView({ DEFAULT_MAP_VIEW: "41,2,30" })).toEqual(
      DEFAULT_MAP_VIEW,
    ); // zoom > 22
  });

  it("accepts boundary values", () => {
    expect(resolveDefaultMapView({ DEFAULT_MAP_VIEW: "-90,180,0" })).toEqual({
      latitude: -90,
      longitude: 180,
      zoom: 0,
    });
  });
});

describe("resolveMapSources", () => {
  it("uses key-free defaults when nothing is configured", () => {
    expect(resolveMapSources({})).toEqual(DEFAULT_MAP_SOURCES);
  });

  it("adds an orthophoto layer with bounds", () => {
    const sources = resolveMapSources({
      MAP_ORTHOPHOTO_TILES:
        "https://example.org/wms?SERVICE=WMS&REQUEST=GetMap&BBOX={bbox-epsg-3857}",
      MAP_ORTHOPHOTO_ATTRIBUTION: "© Example",
      MAP_ORTHOPHOTO_BOUNDS: "7.5,47.5,10.5,49.8",
    });
    expect(sources.orthophoto).toEqual({
      tiles:
        "https://example.org/wms?SERVICE=WMS&REQUEST=GetMap&BBOX={bbox-epsg-3857}",
      attribution: "© Example",
      bounds: [7.5, 47.5, 10.5, 49.8],
      tileSize: 256,
      maxzoom: 22,
    });
  });

  it("adds a toggleable overlay over all base maps", () => {
    const sources = resolveMapSources({
      MAP_OVERLAY_TILES:
        "https://example.org/wms?SERVICE=WMS&REQUEST=GetMap&BBOX={bbox-epsg-3857}",
      MAP_OVERLAY_NAME: "UAS geozones",
      MAP_OVERLAY_ATTRIBUTION: "© Example",
      MAP_OVERLAY_BOUNDS: "5.8,47.2,15.1,55.1",
      MAP_OVERLAY_OPACITY: "0.5",
    });
    expect(sources.overlay).toEqual({
      name: "UAS geozones",
      tiles:
        "https://example.org/wms?SERVICE=WMS&REQUEST=GetMap&BBOX={bbox-epsg-3857}",
      attribution: "© Example",
      bounds: [5.8, 47.2, 15.1, 55.1],
      tileSize: 256,
      maxzoom: 22,
      opacity: 0.5,
    });
    expect(
      resolveMapSources({
        MAP_OVERLAY_TILES: "https://example.org/{z}/{x}/{y}.png",
        MAP_OVERLAY_OPACITY: "7",
      }).overlay?.opacity,
    ).toBe(0.6);
    expect(
      resolveMapSources({ MAP_OVERLAY_TILES: "javascript:alert(1)" }).overlay,
    ).toBeNull();
  });

  it("drops invalid bounds but keeps the layer", () => {
    const sources = resolveMapSources({
      MAP_ORTHOPHOTO_TILES: "https://example.org/{z}/{x}/{y}.png",
      MAP_ORTHOPHOTO_BOUNDS: "10,50,7,48",
    });
    expect(sources.orthophoto?.bounds).toBeUndefined();
  });

  it("ignores URLs that are not http(s)", () => {
    const sources = resolveMapSources({
      MAP_STREET_STYLE: "javascript:alert(1)",
      MAP_EXTRA_STYLE_URL: "ftp://example.org/style.json",
    });
    expect(sources.streetStyle).toBe(DEFAULT_MAP_SOURCES.streetStyle);
    expect(sources.extraStyle).toBeNull();
  });

  it("adds an extra style and replaces the terrain source", () => {
    const sources = resolveMapSources({
      MAP_EXTRA_STYLE_NAME: "basemap.de",
      MAP_EXTRA_STYLE_URL: "https://example.org/style.json",
      MAP_TERRAIN_TILES: "https://example.org/dem/{z}/{x}/{y}.png",
      MAP_TERRAIN_ENCODING: "mapbox",
      MAP_TERRAIN_MAXZOOM: "12",
    });
    expect(sources.extraStyle).toEqual({
      name: "basemap.de",
      url: "https://example.org/style.json",
    });
    expect(sources.terrain).toMatchObject({
      encoding: "mapbox",
      maxzoom: 12,
      tileSize: 256,
    });
  });

  it("turns the geocoder off", () => {
    expect(resolveMapSources({ MAP_GEOCODER_URL: "off" }).geocoderUrl).toBe(
      null,
    );
  });
});

describe("resolveTrustedNetworks / isTrustedAddress", () => {
  it("is off when TRUSTED_NETWORKS is unset or has no valid entry", () => {
    expect(resolveTrustedNetworks({})).toBeNull();
    expect(
      resolveTrustedNetworks({ TRUSTED_NETWORKS: "nonsense, 10.0.0.0/99" }),
    ).toBeNull();
  });

  it("matches IPv4, IPv6 and IPv4-mapped addresses", () => {
    const nets = resolveTrustedNetworks({
      TRUSTED_NETWORKS: "192.168.178.0/24, 100.64.0.0/10 fd1a:baaf:283e::/64",
    });
    expect(isTrustedAddress(nets, "192.168.178.42")).toBe(true);
    expect(isTrustedAddress(nets, "::ffff:192.168.178.42")).toBe(true);
    expect(isTrustedAddress(nets, "100.98.97.84")).toBe(true);
    expect(isTrustedAddress(nets, "fd1a:baaf:283e::1234")).toBe(true);
    expect(isTrustedAddress(nets, "192.168.179.1")).toBe(false);
    expect(isTrustedAddress(nets, "8.8.8.8")).toBe(false);
    expect(isTrustedAddress(nets, undefined)).toBe(false);
  });
});
