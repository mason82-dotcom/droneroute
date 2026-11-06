import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WAYPOINT_PATH } from "./constants.js";
import { findMountedDevices, findWaypointDir } from "./volumes.js";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "droneroute-cli-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function makeWaypointDir(root: string): string {
  const dir = path.join(root, WAYPOINT_PATH);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

describe("findWaypointDir", () => {
  it("finds the waypoint folder below a storage root", () => {
    const expected = makeWaypointDir(tmp);
    expect(findWaypointDir(tmp)).toBe(expected);
  });

  it("accepts the waypoint folder itself", () => {
    const expected = makeWaypointDir(tmp);
    expect(findWaypointDir(expected)).toBe(expected);
    expect(findWaypointDir(expected + "/")).toBe(expected + "/");
  });

  it("looks one level down for MTP storage roots", () => {
    const expected = makeWaypointDir(path.join(tmp, "Internal shared storage"));
    expect(findWaypointDir(tmp, { descend: true })).toBe(expected);
  });

  it("returns null when DJI Fly has not created the folder yet", () => {
    fs.mkdirSync(path.join(tmp, "Android", "data"), { recursive: true });
    expect(findWaypointDir(tmp)).toBeNull();
    expect(findWaypointDir(path.join(tmp, "missing"))).toBeNull();
  });

  it("does not accept an arbitrary folder as the waypoint folder", () => {
    expect(findWaypointDir(tmp)).toBeNull();
  });
});

describe("findMountedDevices", () => {
  it("labels GVFS MTP devices and finds their storage", () => {
    const mtp = path.join(tmp, "mtp:host=DJI_RC_2_ABC123");
    const expected = makeWaypointDir(path.join(mtp, "Internal shared storage"));
    const sdCard = path.join(tmp, "SDCARD");
    fs.mkdirSync(sdCard);

    const devices = findMountedDevices([
      { path: mtp, kind: "mtp" },
      { path: sdCard, kind: "volume" },
    ]);

    expect(devices).toEqual([
      {
        label: `MTP device DJI RC 2 ABC123 (${mtp})`,
        waypointPath: expected,
        mountPoint: mtp,
      },
    ]);
  });
});

describe("findWaypointDir edge cases", () => {
  it("only descends into subfolders when asked", () => {
    makeWaypointDir(path.join(tmp, "SDCARD"));
    expect(findWaypointDir(tmp)).toBeNull();
    expect(findWaypointDir(tmp, { descend: true })).toBe(
      path.join(tmp, "SDCARD", WAYPOINT_PATH),
    );
  });

  it("matches the waypoint folder by whole segments, ignoring case", () => {
    const real = makeWaypointDir(tmp);
    const upper = real.replace(/waypoint$/, "Waypoint");
    if (fs.existsSync(upper)) {
      // Case-insensitive file system (macOS, Windows)
      expect(findWaypointDir(upper)).toBe(upper);
    }
    const lookalike = path.join(tmp, "MyAndroid/data/dji.go.v5/files/waypoint");
    fs.mkdirSync(lookalike, { recursive: true });
    expect(findWaypointDir(lookalike)).toBeNull();
  });

  it("keeps the raw name for malformed MTP folder names", () => {
    const mtp = path.join(tmp, "mtp:host=RC_100%_X");
    makeWaypointDir(path.join(mtp, "Internal shared storage"));
    const [device] = findMountedDevices([{ path: mtp, kind: "mtp" }]);
    expect(device.label).toBe(`MTP device RC 100% X (${mtp})`);
  });
});
