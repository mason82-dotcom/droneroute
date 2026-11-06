import { describe, expect, it } from "vitest";
import {
  DRONE_MODELS,
  computeOrthoPlan,
  findMissionModel,
} from "@droneroute/shared";
import { DEFAULT_GRID_PARAMS, generateGrid } from "./templates";

const m3e = findMissionModel({
  droneEnumValue: 77,
  droneSubEnumValue: 0,
  payloadEnumValue: 66,
})!.payload.camera!;

// ~200 m (E-W) x ~100 m (N-S) near Forst
const corner1: [number, number] = [49.15, 8.58];
const corner2: [number, number] = [49.1509, 8.58274];

describe("computeOrthoPlan", () => {
  it("matches the DJI Mavic 3E ground resolution (H/36.5 cm/px)", () => {
    const plan = computeOrthoPlan(m3e, 100, 80, 70);
    // DJI rounds its rule of thumb; stay within 5 %.
    expect(Math.abs(plan.gsdCm / (100 / 36.5) - 1)).toBeLessThan(0.05);
    expect(plan.footprintAcrossM).toBeCloseTo(140.8, 1);
    expect(plan.lineSpacingM).toBeCloseTo(plan.footprintAcrossM * 0.3, 6);
    expect(plan.photoSpacingM).toBeCloseTo(plan.footprintAlongM * 0.2, 6);
  });

  it("clamps overlaps to 0–95 %", () => {
    const plan = computeOrthoPlan(m3e, 100, 120, -10);
    expect(plan.photoSpacingM).toBeCloseTo(plan.footprintAlongM * 0.05, 6);
    expect(plan.lineSpacingM).toBeCloseTo(plan.footprintAcrossM, 6);
  });

  it("has a camera profile for every mapping-capable payload", () => {
    const missing = DRONE_MODELS.flatMap((d) =>
      d.payloads.filter((p) => !p.camera).map((p) => p.label),
    );
    expect(missing.sort()).toEqual(["H20N", "H20N", "PSDK", "PSDK"]);
  });
});

describe("generateGrid in orthomosaic mode", () => {
  it("adds photo waypoints so front and side overlap are met", () => {
    const altitude = 60;
    const result = generateGrid(
      {
        ...DEFAULT_GRID_PARAMS,
        corner1,
        corner2,
        altitude,
        orthoMode: true,
      },
      m3e,
    );
    const plan = computeOrthoPlan(m3e, altitude, 80, 70);
    expect(result.ortho).toEqual(plan);
    const passes = Math.max(2, Math.ceil(100 / plan.lineSpacingM) + 1);
    const perPass = Math.max(2, Math.ceil(200 / plan.photoSpacingM) + 1);

    expect(result.waypoints).toHaveLength(passes * perPass);
    expect(
      result.waypoints.every((wp) =>
        wp.actions.some((a) => a.actionType === "takePhoto"),
      ),
    ).toBe(true);
    expect(result.waypoints.every((wp) => wp.gimbalPitchAngle === -90)).toBe(
      true,
    );

    // Neighbouring photos on the first pass are no further apart than the
    // photo spacing.
    const [a, b] = result.waypoints;
    const dx =
      (b.longitude - a.longitude) *
      111320 *
      Math.cos((a.latitude * Math.PI) / 180);
    expect(Math.abs(dx)).toBeLessThanOrEqual(plan.photoSpacingM + 0.01);
  });

  it("falls back to the manual spacing without a camera profile", () => {
    const result = generateGrid({
      ...DEFAULT_GRID_PARAMS,
      corner1,
      corner2,
      orthoMode: true,
    });
    const manual = generateGrid({ ...DEFAULT_GRID_PARAMS, corner1, corner2 });
    expect(result.waypoints).toEqual(manual.waypoints);
    expect(result.ortho).toBeUndefined();
  });

  it("keeps two waypoints per pass in the normal mode", () => {
    const result = generateGrid({
      ...DEFAULT_GRID_PARAMS,
      corner1,
      corner2,
      spacingM: 30,
    });
    expect(result.waypoints).toHaveLength(
      2 * Math.max(2, Math.ceil(100 / 30) + 1),
    );
  });
});
