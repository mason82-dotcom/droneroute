import { describe, it, expect } from "vitest";
import {
  DEFAULT_MISSION_CONFIG,
  DEFAULT_WAYPOINT,
  type Mission,
  type Waypoint,
} from "@droneroute/shared";
import { buildTemplateKml, buildWaylinesWpml } from "./wpml.js";
import { generateKmzBuffer } from "../services/kmzGenerator.js";
import { parseKmz } from "../services/kmzParser.js";

function wp(index: number, extra: Partial<Waypoint> = {}): Waypoint {
  return {
    ...DEFAULT_WAYPOINT,
    index,
    name: `WP${index}`,
    latitude: 41.2579 + index * 0.001,
    longitude: 0.9322,
    ...extra,
  };
}

function mission(waypoints: Waypoint[]): Mission {
  return {
    id: "t",
    name: "Test",
    config: { ...DEFAULT_MISSION_CONFIG },
    waypoints,
    pois: [],
    obstacles: [],
  } as unknown as Mission;
}

const values = (xml: string, tag: string) =>
  [...xml.matchAll(new RegExp(`<wpml:${tag}>([^<]*)<`, "g"))].map((m) => m[1]);

describe("useStraightLine (#74)", () => {
  const m = mission([
    wp(0, {
      useGlobalTurnParam: false,
      turnMode: "toPointAndStopWithContinuityCurvature",
    }),
    wp(1, {
      useGlobalTurnParam: false,
      turnMode: "toPointAndPassWithContinuityCurvature",
      useStraightLine: false,
    }),
    wp(2),
  ]);

  it("writes straight segments by default and curved ones only when chosen", () => {
    expect(values(buildWaylinesWpml(m), "useStraightLine")).toEqual([
      "1",
      "0",
      "1",
    ]);
    const template = buildTemplateKml(m);
    expect(values(template, "useStraightLine")).toEqual(["1", "0", "1"]);
    expect(values(template, "globalUseStraightLine")).toEqual(["1"]);
  });

  it("survives an export/import round trip", async () => {
    const parsed = await parseKmz(await generateKmzBuffer(m));
    expect(parsed.waypoints.map((w) => w.useStraightLine)).toEqual([
      true,
      false,
      true,
    ]);
  });
});

describe("useStraightLine review fixes", () => {
  it("writes the turn mode of non-global waypoints into template.kml", () => {
    const m = mission([
      wp(0, {
        useGlobalTurnParam: false,
        turnMode: "toPointAndPassWithContinuityCurvature",
      }),
      wp(1),
    ]);
    const template = buildTemplateKml(m);
    expect(values(template, "waypointTurnMode")).toEqual([
      "toPointAndPassWithContinuityCurvature",
    ]);
  });

  it("keeps turnMode through an export/import round trip", async () => {
    const m = mission([
      wp(0, {
        useGlobalTurnParam: false,
        turnMode: "toPointAndStopWithContinuityCurvature",
      }),
      wp(1, {
        useGlobalTurnParam: false,
        turnMode: "toPointAndPassWithContinuityCurvature",
        useStraightLine: false,
      }),
    ]);
    const parsed = await parseKmz(await generateKmzBuffer(m));
    expect(parsed.waypoints.map((w) => w.turnMode)).toEqual([
      "toPointAndStopWithContinuityCurvature",
      "toPointAndPassWithContinuityCurvature",
    ]);
  });

  it("reads a missing useStraightLine like DJI: global value, else curved for curve modes", async () => {
    const m = mission([
      wp(0, {
        useGlobalTurnParam: false,
        turnMode: "toPointAndStopWithContinuityCurvature",
      }),
      wp(1, {
        useGlobalTurnParam: false,
        turnMode: "toPointAndStopWithDiscontinuityCurvature",
      }),
    ]);
    const strip = (xml: string) =>
      xml.replace(/\s*<wpml:useStraightLine>[01]<\/wpml:useStraightLine>/g, "");
    const JSZip = (await import("jszip")).default;

    const withoutAny = new JSZip();
    withoutAny.file(
      "wpmz/template.kml",
      strip(buildTemplateKml(m)).replace(
        /\s*<wpml:globalUseStraightLine>1<\/wpml:globalUseStraightLine>/,
        "",
      ),
    );
    withoutAny.file("wpmz/waylines.wpml", strip(buildWaylinesWpml(m)));
    const a = await parseKmz(
      await withoutAny.generateAsync({ type: "nodebuffer" }),
    );
    expect(a.waypoints.map((w) => w.useStraightLine)).toEqual([
      false,
      undefined,
    ]);

    const globalOnly = new JSZip();
    globalOnly.file("wpmz/template.kml", strip(buildTemplateKml(m)));
    globalOnly.file("wpmz/waylines.wpml", strip(buildWaylinesWpml(m)));
    const b = await parseKmz(
      await globalOnly.generateAsync({ type: "nodebuffer" }),
    );
    expect(b.waypoints[0].useStraightLine).toBe(true);
  });
});

describe("area templates from DJI Pilot 2", () => {
  it("reads the waypoints from waylines.wpml when template.kml has no points", async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file(
      "wpmz/template.kml",
      `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.6"><Document>
<wpml:missionConfig><wpml:droneInfo><wpml:droneEnumValue>99</wpml:droneEnumValue><wpml:droneSubEnumValue>0</wpml:droneSubEnumValue></wpml:droneInfo>
<wpml:payloadInfo><wpml:payloadEnumValue>89</wpml:payloadEnumValue></wpml:payloadInfo></wpml:missionConfig>
<Folder><wpml:templateType>mappingCylinder</wpml:templateType><Placemark><wpml:cylinderRadius>20</wpml:cylinderRadius></Placemark></Folder>
</Document></kml>`,
    );
    zip.file(
      "wpmz/waylines.wpml",
      `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.6"><Document><Folder>
<wpml:autoFlightSpeed>8</wpml:autoFlightSpeed>
<Placemark><Point><coordinates>8.59,49.16</coordinates></Point><wpml:index>0</wpml:index><wpml:executeHeight>60</wpml:executeHeight></Placemark>
<Placemark><Point><coordinates>8.591,49.161</coordinates></Point><wpml:index>1</wpml:index><wpml:executeHeight>70</wpml:executeHeight></Placemark>
</Folder></Document></kml>`,
    );
    const parsed = await parseKmz(
      await zip.generateAsync({ type: "nodebuffer" }),
    );
    expect(
      parsed.waypoints.map((w) => [w.longitude, w.latitude, w.height]),
    ).toEqual([
      [8.59, 49.16, 60],
      [8.591, 49.161, 70],
    ]);
  });
});
