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
