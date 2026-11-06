import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { WAYPOINT_PATH } from "./constants.js";

/** A DJI controller detected via a mounted filesystem. */
export interface MountedDevice {
  /** Human-readable label, e.g. "SD card (/Volumes/DJI_RC)". */
  label: string;
  /** Full path to the waypoint directory on the mounted volume. */
  waypointPath: string;
  /** Mount point root. */
  mountPoint: string;
}

/**
 * Locate the DJI Fly waypoint directory for a user-supplied or detected path.
 *
 * Accepts the waypoint directory itself or the storage root that contains
 * `Android/data/dji.go.v5/files/waypoint`. With `descend`, it also looks one
 * level down, for device folders above the storage roots (MTP devices expose
 * e.g. "Internal shared storage"). Returns `null` when nothing is found.
 */
export function findWaypointDir(
  dir: string,
  { descend = false }: { descend?: boolean } = {},
): string | null {
  if (isWaypointPath(dir) && isDirectory(dir)) return dir;

  const direct = path.join(dir, WAYPOINT_PATH);
  if (isDirectory(direct)) return direct;
  if (!descend) return null;

  for (const sub of listSubdirs(dir)) {
    const nested = path.join(sub, WAYPOINT_PATH);
    if (isDirectory(nested)) return nested;
  }
  return null;
}

/** Whether `p` ends with the DJI Fly waypoint path (whole segments, any case). */
function isWaypointPath(p: string): boolean {
  const segments = p.split(/[\\/]+/).filter(Boolean);
  const expected = WAYPOINT_PATH.split("/");
  const tail = segments.slice(-expected.length);
  return (
    tail.length === expected.length &&
    tail.every((seg, i) => seg.toLowerCase() === expected[i].toLowerCase())
  );
}

/**
 * Scan all plausible mount points for volumes that contain the DJI
 * waypoint directory structure.
 */
export function findMountedDevices(
  roots: { path: string; kind: "volume" | "mtp" }[] = getMountRoots(),
): MountedDevice[] {
  const devices: MountedDevice[] = [];

  for (const root of roots) {
    const waypointPath = findWaypointDir(root.path, {
      descend: root.kind === "mtp",
    });
    if (!waypointPath) continue;

    const name = path.basename(root.path);
    devices.push({
      label:
        root.kind === "mtp"
          ? `MTP device ${mtpName(name)} (${root.path})`
          : `${name} (${root.path})`,
      waypointPath,
      mountPoint: root.path,
    });
  }

  return devices;
}

/** Readable name from a GVFS MTP folder such as "mtp:host=DJI_RC_2_1234". */
function mtpName(folder: string): string {
  let host = folder.replace(/^mtp:host=/, "");
  try {
    host = decodeURIComponent(host);
  } catch {
    // Keep the raw name if it is not valid percent-encoding.
  }
  return host.replace(/_/g, " ");
}

/**
 * Return a list of mount-point roots to probe, depending on the platform.
 */
function getMountRoots(): { path: string; kind: "volume" | "mtp" }[] {
  const platform = os.platform();
  const volumes = (dirs: string[]) =>
    dirs.map((p) => ({ path: p, kind: "volume" as const }));

  if (platform === "darwin") {
    return volumes(listSubdirs("/Volumes"));
  }

  if (platform === "linux") {
    const user = os.userInfo().username;
    const uid = os.userInfo().uid;
    return [
      ...volumes([
        // /media/<user> is a parent of mounts, not a mount itself.
        ...listSubdirs("/media").filter((p) => path.basename(p) !== user),
        ...listSubdirs(`/media/${user}`),
        ...listSubdirs("/mnt"),
        ...listSubdirs(`/run/media/${user}`),
      ]),
      // MTP devices mounted by GVFS (GNOME, Xfce, Cinnamon, …) when the
      // controller is connected in "file transfer" mode. Controllers without
      // USB debugging (e.g. DJI RC 2) are only reachable this way.
      ...listSubdirs(`/run/user/${uid}/gvfs`)
        .filter((p) => path.basename(p).startsWith("mtp:"))
        .map((p) => ({ path: p, kind: "mtp" as const })),
    ];
  }

  if (platform === "win32") {
    // Check drive letters D: through Z:
    const drives: string[] = [];
    for (let code = 68; code <= 90; code++) {
      const letter = `${String.fromCharCode(code)}:\\`;
      try {
        fs.accessSync(letter, fs.constants.R_OK);
        drives.push(letter);
      } catch {
        // Drive not available
      }
    }
    return volumes(drives);
  }

  return [];
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * List immediate subdirectories of a directory, returning their full paths.
 * Returns an empty array if the directory doesn't exist.
 */
function listSubdirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d: fs.Dirent) => d.isDirectory() || d.isSymbolicLink())
      .map((d: fs.Dirent) => path.join(dir, d.name));
  } catch {
    return [];
  }
}
