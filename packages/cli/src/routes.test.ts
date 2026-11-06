import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isMissionUuid,
  findRoute,
  listMountedRoutes,
  parseAdbStat,
  replaceRoute,
} from "./routes.js";

const OLD = "11111111-2222-3333-4444-555555555555";
const NEW = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE";

let tmp: string;
let waypoints: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "droneroute-routes-"));
  waypoints = path.join(tmp, "waypoint");
  fs.mkdirSync(waypoints);
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function addRoute(uuid: string, content: string, mtime: Date, ext = ".KMZ") {
  const dir = path.join(waypoints, uuid);
  fs.mkdirSync(dir);
  const file = path.join(dir, `${uuid}${ext}`);
  fs.writeFileSync(file, content);
  fs.utimesSync(file, mtime, mtime);
  return file;
}

describe("isMissionUuid", () => {
  it("accepts DJI Fly route ids only", () => {
    expect(isMissionUuid(NEW)).toBe(true);
    expect(isMissionUuid(NEW.toLowerCase())).toBe(true);
    expect(isMissionUuid("map_preview")).toBe(false);
    expect(isMissionUuid(`${NEW}x`)).toBe(false);
  });
});

describe("listMountedRoutes", () => {
  it("lists mission folders newest first and skips other entries", () => {
    addRoute(OLD, "old", new Date("2026-01-01"));
    addRoute(NEW, "new", new Date("2026-06-01"), ".kmz");
    fs.mkdirSync(path.join(waypoints, "map_preview"));
    fs.mkdirSync(path.join(waypoints, "99999999-9999-9999-9999-999999999999"));

    const routes = listMountedRoutes(waypoints);
    expect(routes.map((r) => r.uuid)).toEqual([NEW, OLD]);
    expect(routes[0].kmzPath).toBe(path.join(waypoints, NEW, `${NEW}.kmz`));
  });

  it("returns an empty list for a missing folder", () => {
    expect(listMountedRoutes(path.join(tmp, "missing"))).toEqual([]);
  });
});

describe("parseAdbStat", () => {
  it("keeps only <UUID>/<UUID>.KMZ files", () => {
    const base = "/sdcard/Android/data/dji.go.v5/files/waypoint";
    const routes = parseAdbStat(
      [
        `1767225600 ${base}/${OLD}/${OLD}.KMZ`,
        `1780000000 ${base}/${NEW}/other.KMZ`,
        "garbage",
      ].join("\n"),
    );
    expect(routes).toEqual([
      {
        uuid: OLD,
        kmzPath: `${base}/${OLD}/${OLD}.KMZ`,
        modified: new Date(1767225600 * 1000),
      },
    ]);
  });
});

describe("replaceRoute", () => {
  it("overwrites the placeholder and keeps a backup of the original", () => {
    const target = addRoute(OLD, "placeholder", new Date("2026-01-01"));
    const kmz = path.join(tmp, "mission.kmz");
    fs.writeFileSync(kmz, "survey");
    const backups = path.join(tmp, "backups");

    const [route] = listMountedRoutes(waypoints);
    const result = replaceRoute(
      { type: "mounted", label: "test", waypointPath: waypoints },
      route,
      kmz,
      backups,
    );

    expect(fs.readFileSync(target, "utf-8")).toBe("survey");
    expect(fs.readFileSync(result.backupPath, "utf-8")).toBe("placeholder");
    expect(path.dirname(result.backupPath)).toBe(backups);
    expect(result.uuid).toBe(OLD);
  });
});

describe("replaceRoute failures", () => {
  it("does not touch the controller when the new file is missing", () => {
    const target = addRoute(OLD, "placeholder", new Date("2026-01-01"));
    const backups = path.join(tmp, "backups");
    const [route] = listMountedRoutes(waypoints);
    expect(() =>
      replaceRoute(
        { type: "mounted", label: "test", waypointPath: waypoints },
        route,
        path.join(tmp, "missing.kmz"),
        backups,
      ),
    ).toThrow();
    expect(fs.readFileSync(target, "utf-8")).toBe("placeholder");
    expect(fs.existsSync(backups)).toBe(false);
  });
});

describe("findRoute", () => {
  it("finds a mounted route by id in any case", () => {
    addRoute(OLD, "placeholder", new Date("2026-01-01"));
    const device = {
      type: "mounted" as const,
      label: "test",
      waypointPath: waypoints,
    };
    expect(findRoute(device, OLD.toLowerCase())?.uuid).toBe(OLD);
    expect(findRoute(device, NEW)).toBeUndefined();
  });
});
