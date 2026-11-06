import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { adbShell, adbPush } from "./adb.js";
import { ADB_WAYPOINT_PATH, KMZ_EXTENSION } from "./constants.js";
import type { DjiDevice } from "./device.js";

/**
 * Replacing an existing route is the fallback for DJI Fly versions that only
 * list routes they created themselves: the pilot saves a placeholder route in
 * DJI Fly, and the CLI overwrites its KMZ.
 */

const UUID_RE =
  /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

export function isMissionUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** A route DJI Fly already knows: `<waypoint dir>/<UUID>/<UUID>.KMZ`. */
export interface ExistingRoute {
  uuid: string;
  /** Path of the KMZ, local (mounted) or on the device (adb). */
  kmzPath: string;
  modified: Date;
}

/** Routes in a mounted waypoint directory, newest first. */
export function listMountedRoutes(waypointDir: string): ExistingRoute[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(waypointDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const routes: ExistingRoute[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isMissionUuid(entry.name)) continue;
    const dir = path.join(waypointDir, entry.name);
    const file = findKmz(dir, entry.name);
    if (!file) continue;
    try {
      routes.push({
        uuid: entry.name,
        kmzPath: path.join(dir, file),
        modified: fs.statSync(path.join(dir, file)).mtime,
      });
    } catch {
      // Vanished or unreadable: skip
    }
  }
  return sortNewestFirst(routes);
}

/** `<UUID>.KMZ` in a mission folder, matching the extension in any case. */
function findKmz(dir: string, uuid: string): string | undefined {
  try {
    return fs
      .readdirSync(dir)
      .find((f) => f.toUpperCase() === `${uuid}${KMZ_EXTENSION}`.toUpperCase());
  } catch {
    return undefined;
  }
}

/** Routes on an adb device, newest first. */
export function listAdbRoutes(serial: string): ExistingRoute[] {
  let output: string;
  try {
    // "<mtime> <path>" per mission KMZ; toybox stat supports -c.
    output = adbShell(
      serial,
      `stat -c '%Y %n' "${ADB_WAYPOINT_PATH}"/*/*.[Kk][Mm][Zz] 2>/dev/null`,
    );
  } catch {
    return [];
  }
  return sortNewestFirst(parseAdbStat(output));
}

/** Parse `stat -c '%Y %n'` lines into routes whose file matches its folder. */
export function parseAdbStat(output: string): ExistingRoute[] {
  const routes: ExistingRoute[] = [];
  for (const line of output.split("\n")) {
    const match = line.trim().match(/^(\d+) (.+)$/);
    if (!match) continue;
    const [, mtime, kmzPath] = match;
    const parts = kmzPath.split("/");
    const uuid = parts[parts.length - 2] ?? "";
    const file = parts[parts.length - 1] ?? "";
    if (
      !isMissionUuid(uuid) ||
      file.toUpperCase() !== `${uuid}${KMZ_EXTENSION}`.toUpperCase()
    ) {
      continue;
    }
    routes.push({ uuid, kmzPath, modified: new Date(Number(mtime) * 1000) });
  }
  return routes;
}

function sortNewestFirst(routes: ExistingRoute[]): ExistingRoute[] {
  return routes.sort((a, b) => b.modified.getTime() - a.modified.getTime());
}

/** Existing routes on the selected controller, newest first. */
export function listRoutes(device: DjiDevice): ExistingRoute[] {
  return device.type === "mounted"
    ? listMountedRoutes(device.waypointPath!)
    : listAdbRoutes(device.serial!);
}

/** Where the original KMZ of a replaced route is kept. */
export function defaultBackupDir(): string {
  return path.join(os.homedir(), ".droneroute", "backups");
}

export interface ReplaceResult {
  uuid: string;
  remotePath: string;
  backupPath: string;
}

/**
 * Overwrite an existing route's KMZ with `kmzPath`. The original is copied to
 * `backupDir` first; if writing a mounted route fails, it is restored.
 */
export function replaceRoute(
  device: DjiDevice,
  route: ExistingRoute,
  kmzPath: string,
  backupDir: string = defaultBackupDir(),
): ReplaceResult {
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(
    backupDir,
    `${route.uuid}-${stamp}${KMZ_EXTENSION}`,
  );

  if (device.type === "mounted") {
    const original = fs.readFileSync(route.kmzPath);
    fs.writeFileSync(backupPath, original);
    try {
      // Write instead of copyFile for MTP (GVFS FUSE) mounts.
      fs.writeFileSync(route.kmzPath, fs.readFileSync(kmzPath));
    } catch (err) {
      try {
        fs.writeFileSync(route.kmzPath, original);
      } catch {
        // Restore failed too; the backup path is reported by the caller.
      }
      throw err;
    }
  } else {
    execFileSync(
      "adb",
      ["-s", device.serial!, "pull", route.kmzPath, backupPath],
      { stdio: "pipe", timeout: 30_000 },
    );
    adbPush(device.serial!, kmzPath, route.kmzPath);
  }

  return { uuid: route.uuid, remotePath: route.kmzPath, backupPath };
}
