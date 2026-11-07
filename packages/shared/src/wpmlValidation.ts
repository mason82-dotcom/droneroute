// Validation of a mission against the DJI WPML reference (Cloud API, dji-wpml: common-element,
// template-kml, waylines-wpml; rendered 07.11.2026). Only rules the DJI documentation states are
// "error"; recommendations and DJI-documented limitations are "warning".
import type { Mission, Waypoint, WaypointAction } from "./types.js";
import { DRONE_MODELS, THERMAL_PAYLOAD_VALUES } from "./types.js";

export type IssueLevel = "error" | "warning";
export interface ValidationIssue {
  level: IssueLevel;
  /** WPML element, e.g. "takeOffSecurityHeight" or "waypoint[3].waypointSpeed". */
  field: string;
  message: string;
}

const ENUMS = {
  flyToWaylineMode: ["safely", "pointToPoint"],
  finishAction: ["goHome", "noAction", "autoLand", "gotoFirstWaypoint"],
  exitOnRCLost: ["goContinue", "executeLostAction"],
  executeRCLostAction: ["goBack", "landing", "hover"],
  // realTimeFollowSurface exists in WPML but only for mapping templates (not waypoint routes).
  heightMode: ["EGM96", "relativeToStartPoint", "aboveGroundLevel"],
  waypointHeadingMode: [
    "followWayline",
    "manually",
    "fixed",
    "smoothTransition",
    "towardPOI",
  ],
  waypointTurnMode: [
    "coordinateTurn",
    "toPointAndStopWithDiscontinuityCurvature",
    "toPointAndStopWithContinuityCurvature",
    "toPointAndPassWithContinuityCurvature",
  ],
  gimbalPitchMode: ["manual", "usePointSetting"],
  lens: ["wide", "zoom", "ir", "narrow_band", "visable"],
} as const;

// Turn modes for which DJI requires waypointTurnDampingDist.
const DAMPING_TURN_MODES = [
  "coordinateTurn",
  "toPointAndPassWithContinuityCurvature",
];
// panoShot: "Supported by M30/30T, M3D/M3TD, M4D/M4TD, M4E/M4T" (drone enums 67/68, 91, 100, 99).
const PANO_DRONES = [67, 68, 91, 99, 100];

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

function haversine(a: Waypoint, b: Waypoint): number {
  const r = 6371008.8,
    rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad,
    dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

export function validateMission(mission: Mission): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const err = (field: string, message: string) =>
    out.push({ level: "error", field, message });
  const warn = (field: string, message: string) =>
    out.push({ level: "warning", field, message });
  const c = mission.config;
  const oneOf = (field: string, value: unknown, allowed: readonly string[]) => {
    if (!allowed.includes(String(value)))
      err(
        field,
        `"${String(value)}" is not allowed (DJI: ${allowed.join(", ")})`,
      );
  };

  // ── missionConfig ──
  oneOf("flyToWaylineMode", c.flyToWaylineMode, ENUMS.flyToWaylineMode);
  oneOf("finishAction", c.finishAction, ENUMS.finishAction);
  oneOf("exitOnRCLost", c.exitOnRCLost, ENUMS.exitOnRCLost);
  if (c.exitOnRCLost === "executeLostAction")
    oneOf(
      "executeRCLostAction",
      c.executeRCLostAction,
      ENUMS.executeRCLostAction,
    );
  if (
    !isNum(c.takeOffSecurityHeight) ||
    c.takeOffSecurityHeight < 1.2 ||
    c.takeOffSecurityHeight > 1500
  )
    err(
      "takeOffSecurityHeight",
      "must be 1.2–1500 m for a remote controller (DJI)",
    );
  if (
    !isNum(c.globalTransitionalSpeed) ||
    c.globalTransitionalSpeed <= 0 ||
    c.globalTransitionalSpeed > 15
  )
    err("globalTransitionalSpeed", "must be > 0 and ≤ 15 m/s (DJI)");
  if (!isNum(c.autoFlightSpeed) || c.autoFlightSpeed <= 0)
    err("autoFlightSpeed", "must be > 0 m/s (DJI)");
  else if (c.autoFlightSpeed > 15)
    warn(
      "autoFlightSpeed",
      "above 15 m/s – check the maximum route speed of this drone (DJI: model dependent)",
    );

  const model =
    DRONE_MODELS.find(
      (m) =>
        m.droneEnumValue === c.droneEnumValue &&
        m.droneSubEnumValue === c.droneSubEnumValue,
    ) || DRONE_MODELS.find((m) => m.droneEnumValue === c.droneEnumValue);
  if (!model)
    err(
      "droneEnumValue",
      `drone ${c.droneEnumValue}-${c.droneSubEnumValue} is not in the DJI product list`,
    );
  else if (
    !model.payloads.some((p) => p.payloadEnumValue === c.payloadEnumValue)
  )
    err(
      "payloadEnumValue",
      `payload ${c.payloadEnumValue} does not belong to ${model.label}`,
    );

  oneOf("heightMode", c.heightMode, ENUMS.heightMode);
  if (c.heightMode === "aboveGroundLevel")
    warn(
      "heightMode",
      "aboveGroundLevel is only supported by FlightHub 2 (DJI); for DJI Pilot 2 use relativeToStartPoint or EGM96",
    );
  oneOf(
    "globalWaypointHeadingParam.waypointHeadingMode",
    c.globalHeadingMode,
    ENUMS.waypointHeadingMode,
  );
  oneOf("globalWaypointTurnMode", c.globalTurnMode, ENUMS.waypointTurnMode);
  oneOf("gimbalPitchMode", c.gimbalPitchMode, ENUMS.gimbalPitchMode);
  if (c.imageFormat !== undefined) {
    const parts = String(c.imageFormat).split(",");
    if (!parts.length || parts.some((p) => !ENUMS.lens.includes(p as any)))
      err(
        "payloadParam.imageFormat",
        `"${c.imageFormat}" is not a DJI lens list`,
      );
    else if (
      parts.includes("ir") &&
      !THERMAL_PAYLOAD_VALUES.includes(c.payloadEnumValue)
    )
      err("payloadParam.imageFormat", "infrared (ir) needs a thermal payload");
  }

  // ── waypoints ──
  const wps = mission.waypoints || [];
  // An empty, new mission is not an error yet; one waypoint is.
  if (wps.length === 1)
    err("Placemark", "a waypoint route needs at least 2 waypoints");
  wps.forEach((w, i) => {
    const f = (name: string) => `waypoint[${i + 1}].${name}`;
    if (!isNum(w.latitude) || w.latitude < -90 || w.latitude > 90)
      err(f("latitude"), "must be −90…90°");
    if (!isNum(w.longitude) || w.longitude < -180 || w.longitude > 180)
      err(f("longitude"), "must be −180…180°");
    if (!isNum(w.height)) err(f("height"), "missing height");
    if (!w.useGlobalSpeed && (!isNum(w.speed) || w.speed <= 0))
      err(f("waypointSpeed"), "must be > 0 m/s (DJI)");
    if (!w.useGlobalHeadingParam) {
      if (w.headingMode)
        oneOf(
          f("waypointHeadingMode"),
          w.headingMode,
          ENUMS.waypointHeadingMode,
        );
      if (
        w.headingAngle !== undefined &&
        (!isNum(w.headingAngle) ||
          w.headingAngle < -180 ||
          w.headingAngle > 180)
      )
        err(f("waypointHeadingAngle"), "must be −180…180° (DJI)");
      if (
        w.headingMode === "towardPOI" &&
        !(mission.pois || []).some((p) => p.id === w.poiId)
      )
        err(f("waypointPoiPoint"), "towardPOI needs a point of interest (DJI)");
    }
    const turn = w.useGlobalTurnParam
      ? c.globalTurnMode
      : w.turnMode || c.globalTurnMode;
    if (!w.useGlobalTurnParam && w.turnMode)
      oneOf(f("waypointTurnMode"), w.turnMode, ENUMS.waypointTurnMode);
    if (!w.useGlobalTurnParam && DAMPING_TURN_MODES.includes(turn)) {
      const d = w.turnDampingDist;
      if (!isNum(d) || d <= 0)
        err(
          f("waypointTurnDampingDist"),
          `required and > 0 m for ${turn} (DJI)`,
        );
      else {
        const seg = Math.max(
          i > 0 ? haversine(wps[i - 1], w) : 0,
          i < wps.length - 1 ? haversine(w, wps[i + 1]) : 0,
        );
        if (seg > 0 && d > seg)
          err(
            f("waypointTurnDampingDist"),
            `${d} m is longer than the route segment (${seg.toFixed(1)} m, DJI)`,
          );
      }
    }
    if (!isNum(w.gimbalPitchAngle))
      err(f("gimbalPitchAngle"), "missing gimbal pitch");
    (w.actions || []).forEach((a, k) =>
      validateAction(
        a,
        `waypoint[${i + 1}].action[${k + 1}]`,
        c.droneEnumValue,
        err,
      ),
    );
  });
  // DJI: a segment must be longer than the sum of the turn intercepts of its two waypoints.
  for (let i = 0; i + 1 < wps.length; i++) {
    const a = wps[i],
      b = wps[i + 1];
    const da =
      !a.useGlobalTurnParam && DAMPING_TURN_MODES.includes(a.turnMode || "")
        ? a.turnDampingDist || 0
        : 0;
    const db =
      !b.useGlobalTurnParam && DAMPING_TURN_MODES.includes(b.turnMode || "")
        ? b.turnDampingDist || 0
        : 0;
    const seg = haversine(a, b);
    if (da + db > 0 && da + db >= seg)
      err(
        `waypoint[${i + 1}]–[${i + 2}].waypointTurnDampingDist`,
        `turn distances (${da + db} m) must be shorter than the segment (${seg.toFixed(1)} m, DJI)`,
      );
  }
  return out;
}

function validateAction(
  a: WaypointAction,
  field: string,
  droneEnum: number,
  err: (f: string, m: string) => void,
) {
  const p = (a.params || {}) as any;
  switch (a.actionType) {
    case "hover":
      if (!isNum(p.hoverTime) || p.hoverTime <= 0)
        err(field + ".hoverTime", "must be > 0 s (DJI)");
      break;
    case "rotateYaw":
      if (
        !isNum(p.aircraftHeading) ||
        p.aircraftHeading < -180 ||
        p.aircraftHeading > 180
      )
        err(field + ".aircraftHeading", "must be −180…180° (DJI)");
      if (
        p.aircraftPathMode !== undefined &&
        !["clockwise", "counterClockwise"].includes(p.aircraftPathMode)
      )
        err(
          field + ".aircraftPathMode",
          "must be clockwise or counterClockwise (DJI)",
        );
      break;
    case "zoom":
      if (!isNum(p.focalLength) || p.focalLength <= 0)
        err(field + ".focalLength", "must be > 0 mm (DJI)");
      break;
    case "focus":
      for (const k of ["focusX", "focusY"])
        if (p[k] !== undefined && (!isNum(p[k]) || p[k] < 0 || p[k] > 1))
          err(`${field}.${k}`, "must be 0…1 (DJI)");
      break;
    case "gimbalRotate":
      if (
        p.gimbalRotateMode !== undefined &&
        p.gimbalRotateMode !== "absoluteAngle"
      )
        err(field + ".gimbalRotateMode", "must be absoluteAngle (DJI)");
      break;
    default:
      break;
  }
  if (
    (a.actionType as string) === "panoShot" &&
    !PANO_DRONES.includes(droneEnum)
  )
    err(field, "panoShot is not supported by this drone (DJI)");
}
