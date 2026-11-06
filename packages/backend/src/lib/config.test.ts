import { describe, it, expect } from "vitest";
import { DEFAULT_MAP_SOURCES, DEFAULT_MAP_VIEW } from "@droneroute/shared";
import { resolveDefaultMapView, resolveMapSources } from "./config.js";

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
