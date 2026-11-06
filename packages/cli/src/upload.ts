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

/** A fresh mission id and the matching file name DJI Fly expects. */
function newMission(): { uuid: string; fileName: string } {
  const uuid = randomUUID().toUpperCase();
  return { uuid, fileName: `${uuid}${KMZ_EXTENSION}` };
}

/**
 * Create a new mission slot in a DJI Fly waypoint directory (or any folder):
 * `<dir>/<UUID>/<UUID>.KMZ`, the layout DJI Fly picks up as a new mission.
 */
export function writeMissionFolder(dir: string, kmzPath: string): UploadResult {
  const { uuid, fileName } = newMission();
  const missionDir = path.join(dir, uuid);
  const dest = path.join(missionDir, fileName);
  const data = fs.readFileSync(kmzPath);

  fs.mkdirSync(missionDir, { recursive: true });
  try {
    // Write instead of copyFile: MTP mounts (GVFS FUSE) may not support the
    // copy_file_range fast path.
    fs.writeFileSync(dest, data);
  } catch (err) {
    // Do not leave an empty or truncated route behind in DJI Fly.
    fs.rmSync(missionDir, { recursive: true, force: true });
    throw err;
  }

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
  const { uuid, fileName } = newMission();
  const remoteDir = `${ADB_WAYPOINT_PATH}/${uuid}`;
  const remoteDest = `${remoteDir}/${fileName}`;

  adbMkdir(device.serial!, remoteDir);
  adbPush(device.serial!, kmzPath, remoteDest);

  return {
    uuid,
    remotePath: remoteDest,
  };
}
