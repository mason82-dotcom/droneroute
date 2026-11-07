import { describe, it, expect } from "vitest";
import JSZip from "jszip";
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

describe("camera lenses for thermal payloads (Pilot 2 pattern)", () => {
  const photo = {
    actionId: 0,
    actionType: "takePhoto",
    params: { payloadPositionIndex: 0 },
  } as any;
  const rec = {
    actionId: 1,
    actionType: "startRecord",
    params: { payloadPositionIndex: 0 },
  } as any;
  const m = mission([wp(0, { actions: [photo] }), wp(1, { actions: [rec] })]);
  m.config = {
    ...m.config,
    droneEnumValue: 99,
    droneSubEnumValue: 1,
    payloadEnumValue: 89,
    imageFormat: "visable,ir",
  };

  it("writes payloadParam/imageFormat and an explicit lens per photo/video action", () => {
    const template = buildTemplateKml(m);
    expect(values(template, "imageFormat")).toEqual(["visable,ir"]);
    const waylines = buildWaylinesWpml(m);
    expect(values(waylines, "payloadLensIndex")).toEqual([
      "visable,ir",
      "visable,ir",
    ]);
    expect(values(waylines, "useGlobalPayloadLensIndex")).toEqual(["0", "0"]);
    expect(values(waylines, "imageFormat")).toEqual([]); // Pilot 2 keeps it in the template only
  });

  it("writes nothing without a lens selection or with an unknown value", () => {
    const plain = mission([wp(0, { actions: [photo] })]);
    expect(buildTemplateKml(plain)).not.toContain("payloadParam");
    expect(buildWaylinesWpml(plain)).not.toContain("payloadLensIndex");
    plain.config = { ...plain.config, imageFormat: "wide</wpml:x>" as any };
    expect(buildWaylinesWpml(plain)).not.toContain("payloadLensIndex");
  });

  it("round-trips through KMZ export and import", async () => {
    const parsed = await parseKmz(await generateKmzBuffer(m));
    expect(parsed.config.imageFormat).toBe("visable,ir");
  });
});

describe("DJI WPML validation", async () => {
  const { validateMission } = await import("@droneroute/shared");
  const base = () => {
    const m = mission([wp(0), wp(1)]);
    m.config = {
      ...m.config,
      droneEnumValue: 77,
      droneSubEnumValue: 0,
      payloadEnumValue: 66,
      heightMode: "relativeToStartPoint",
    };
    return m;
  };

  it("accepts a valid route", () => {
    expect(validateMission(base()).filter((i) => i.level === "error")).toEqual(
      [],
    );
  });

  it("flags values outside the DJI ranges and enums", () => {
    const m = base();
    m.config = {
      ...m.config,
      takeOffSecurityHeight: 1,
      globalTransitionalSpeed: 16,
      finishAction: "fly" as any,
      imageFormat: "visable,ir",
    };
    m.waypoints[0] = {
      ...m.waypoints[0],
      useGlobalHeadingParam: false,
      headingAngle: 190,
      actions: [
        { actionId: 0, actionType: "hover", params: { hoverTime: 0 } } as any,
      ],
    };
    const fields = validateMission(m)
      .filter((i) => i.level === "error")
      .map((i) => i.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        "takeOffSecurityHeight",
        "globalTransitionalSpeed",
        "finishAction",
        "payloadParam.imageFormat",
        "waypoint[1].waypointHeadingAngle",
        "waypoint[1].action[1].hoverTime",
      ]),
    );
  });

  it("rejects aboveGroundLevel (FlightHub 2 only) and checks turn damping against the segment", () => {
    const m = base();
    m.config.heightMode = "aboveGroundLevel";
    m.waypoints[0] = {
      ...m.waypoints[0],
      useGlobalTurnParam: false,
      turnMode: "coordinateTurn",
      turnDampingDist: 500,
    };
    const issues = validateMission(m);
    expect(issues.find((i) => i.field === "heightMode")?.level).toBe("error");
    expect(
      issues.some(
        (i) =>
          i.field === "waypoint[1].waypointTurnDampingDist" &&
          i.level === "error",
      ),
    ).toBe(true);
  });

  it("writes executeHeightMode for relative heights in waylines.wpml", () => {
    expect(values(buildWaylinesWpml(base()), "executeHeightMode")).toEqual([
      "relativeToStartPoint",
    ]);
  });
});

describe("defaults", () => {
  it("new missions use a height reference DJI Pilot 2 supports", () => {
    expect(DEFAULT_MISSION_CONFIG.heightMode).toBe("relativeToStartPoint");
    const m = mission([wp(0), wp(1)]);
    expect(values(buildWaylinesWpml(m), "executeHeightMode")).toEqual([
      "relativeToStartPoint",
    ]);
  });
});

describe("KMZ layout", () => {
  it("packs template.kml, waylines.wpml and res/ inside wpmz/ like DJI Pilot 2", async () => {
    const zip = await JSZip.loadAsync(
      await generateKmzBuffer(mission([wp(0), wp(1)])),
    );
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual([
      "wpmz/",
      "wpmz/res/",
      "wpmz/template.kml",
      "wpmz/waylines.wpml",
    ]);
  });

  it("still imports the older root layout", async () => {
    const m = mission([wp(0), wp(1)]);
    const old = new JSZip();
    old.file("template.kml", buildTemplateKml(m));
    old.file("waylines.wpml", buildWaylinesWpml(m));
    const parsed = await parseKmz(
      await old.generateAsync({ type: "nodebuffer" }),
    );
    expect(parsed.waypoints).toHaveLength(2);
  });
});

describe("height reference export", () => {
  it("writes executeHeightMode and no template-only coordinate block into waylines.wpml", () => {
    const xml = buildWaylinesWpml(mission([wp(0), wp(1)]));
    expect(xml).toContain(
      "<wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>",
    );
    expect(xml).not.toContain("waylineCoordinateSysParam");
  });

  it("blocks EGM96 and aboveGroundLevel: validation error and no generated waylines", async () => {
    const { validateMission } = await import("@droneroute/shared");
    for (const heightMode of ["EGM96", "aboveGroundLevel"] as const) {
      const m = mission([wp(0), wp(1)]);
      m.config = { ...m.config, heightMode };
      const issue = validateMission(m).find((i) => i.field === "heightMode");
      expect(issue?.level).toBe("error");
      expect(() => buildWaylinesWpml(m)).toThrow(/cannot be exported/);
    }
  });

  it("warns about relative heights above 120 m (leftover sea-level heights)", async () => {
    const { validateMission } = await import("@droneroute/shared");
    const m = mission([wp(0, { height: 350 }), wp(1, { height: 100 })]);
    const issues = validateMission(m).filter((i) => i.field.endsWith("height"));
    expect(issues.map((i) => [i.field, i.level])).toEqual([
      ["waypoint[1].height", "warning"],
    ]);
  });
});
