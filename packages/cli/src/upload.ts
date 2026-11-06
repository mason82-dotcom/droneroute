import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { adbMkdir, adbPush } from "./adb.js";
import { ADB_WAYPOINT_PATH, KMZ_EXTENSION } from "./constants.js";
import type { DjiDevice } from "./device.js";

export interface UploadResult {
  uuid: string;
  remotePath: string;
}

/**
 * Upload a KMZ file to the selected DJI controller.
 *
 * Creates a new UUID-named mission folder and places the KMZ file
 * inside it with the matching UUID filename, so DJI Fly picks it up
 * as a new mission.
 */
/**
 * Create a new mission slot in a DJI Fly waypoint directory (or any folder):
 * `<dir>/<UUID>/<UUID>.KMZ`, the layout DJI Fly picks up as a new mission.
 */
export function writeMissionFolder(dir: string, kmzPath: string): UploadResult {
  const uuid = randomUUID().toUpperCase();
  const missionDir = path.join(dir, uuid);
  const dest = path.join(missionDir, `${uuid}${KMZ_EXTENSION}`);

  fs.mkdirSync(missionDir, { recursive: true });
  // Read and write instead of copyFile: MTP mounts (GVFS FUSE) may not
  // support the copy_file_range fast path.
  fs.writeFileSync(dest, fs.readFileSync(kmzPath));

  return { uuid, remotePath: dest };
}

/**
 * Upload a KMZ file to the selected DJI controller.
 *
 * Creates a new UUID-named mission folder and places the KMZ file
 * inside it with the matching UUID filename, so DJI Fly picks it up
 * as a new mission.
 */
export function uploadKmz(device: DjiDevice, kmzPath: string): UploadResult {
  if (device.type === "mounted") {
    return writeMissionFolder(device.waypointPath!, kmzPath);
  }

  // adb device
  const uuid = randomUUID().toUpperCase();
  const remoteDir = `${ADB_WAYPOINT_PATH}/${uuid}`;
  const remoteDest = `${remoteDir}/${uuid}${KMZ_EXTENSION}`;

  adbMkdir(device.serial!, remoteDir);
  adbPush(device.serial!, kmzPath, remoteDest);

  return {
    uuid,
    remotePath: remoteDest,
  };
}
