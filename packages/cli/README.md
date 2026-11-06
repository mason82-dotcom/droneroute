<p align="center">
  <img src="https://raw.githubusercontent.com/fcsonline/droneroute/main/droneroute.png" alt="DroneRoute" width="120" />
</p>

# droneroute

Upload DJI waypoint mission KMZ files to RC controllers via USB.

```bash
npx droneroute mission.kmz
```

## What it does

1. Detects DJI RC controllers connected via USB (adb or MTP) or mounted SD cards
2. If multiple controllers are found, lets you choose one
3. Creates a new mission slot on the controller
4. Places the KMZ file so DJI Fly recognizes it immediately

No need to manually create placeholder missions, browse the filesystem, or rename files with UUIDs.

## Prerequisites

- **Node.js 18+** — required to run `npx`
- **adb (Android Debug Bridge)** — needed for USB-connected controllers:
  - macOS: `brew install android-platform-tools`
  - Linux: `apt install adb`
  - Windows: included with [Android SDK platform-tools](https://developer.android.com/tools/releases/platform-tools)
- For SD cards: just insert the card into your computer, no extra tools needed
- For controllers without USB debugging (DJI RC 2, RC-N3): see
  [Controllers without USB debugging](#controllers-without-usb-debugging-dji-rc-2)

## Supported controllers

Any DJI controller running DJI Fly with waypoint support:

- DJI RC
- DJI RC 2
- DJI RC Pro / RC Pro 2
- DJI RC-N1 / RC-N2

## Controllers without USB debugging (DJI RC 2)

The DJI RC 2 and RC-N3 have no developer options, so adb cannot reach them, and
DJI Fly keeps waypoint routes in internal storage, not on the SD card. Connect
the controller via USB and choose **File transfer** (MTP) on it. Create one
route in DJI Fly first, so the waypoint folder exists.

- **Linux (GNOME, Xfce, Cinnamon, …):** open the controller once in the file
  manager. GVFS mounts it under `/run/user/<uid>/gvfs/`, and `npx droneroute
mission.kmz` finds it automatically.
- **Linux (other mounts):** mount it with `jmtpfs` or `simple-mtpfs` and pass the
  mount point:

  ```bash
  jmtpfs ~/rc2
  npx droneroute mission.kmz --dir ~/rc2
  ```

- **macOS / Windows:** MTP devices are not mounted as drives, so write the
  mission folder locally and copy it over:

  ```bash
  npx droneroute mission.kmz --out ./export
  ```

  Then copy the created `<UUID>` folder to
  `Android/data/dji.go.v5/files/waypoint/` on the controller with File Explorer
  (Windows) or [OpenMTP](https://openmtp.ganeshrvel.com/) (macOS).

### If the route does not appear in DJI Fly

Some DJI Fly versions only list routes they created themselves. Then use a
placeholder route:

1. In DJI Fly, create and save a short route (any waypoints).
2. Run the tool with `--replace`. It lists the routes on the controller, newest
   first; pick the placeholder you just saved:

   ```bash
   npx droneroute mission.kmz --replace
   npx droneroute mission.kmz --dir ~/rc2 --replace   # mounted with jmtpfs
   ```

   Or name the route directly: `--replace <uuid>` (the folder name in
   `Android/data/dji.go.v5/files/waypoint/`).

3. Restart DJI Fly and open the placeholder route; it now holds your mission.

The original KMZ is saved to `~/.droneroute/backups/` first. On macOS and
Windows, `--out ./export --replace <uuid>` writes the folder under the
placeholder's id, so copying it over replaces the placeholder's file.

## Options

| Option                 | Description                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `-d, --dir <path>`     | Use controller storage mounted at `<path>` instead of searching for devices.                                         |
| `-o, --out <folder>`   | Write the `<UUID>/<UUID>.KMZ` mission folder to `<folder>` for a manual copy.                                        |
| `-r, --replace [uuid]` | Overwrite an existing DJI Fly route (placeholder) instead of adding a new one; without `<uuid>`, choose from a list. |

## Creating KMZ missions

You can create DJI WPML-compliant KMZ files with:

- **[DroneRoute](https://droneroute.io)** — free, open-source web-based mission planner
- DJI Pilot 2
- DJI FlightHub 2
- Any tool that generates DJI WPML KMZ files

## How it works

DJI Fly stores waypoint missions on the controller at:

```
Android/data/dji.go.v5/files/waypoint/<uuid>/<uuid>.KMZ
```

Each mission lives in a folder named with a UUID, containing a single KMZ file with the same UUID as its filename. This tool generates a new UUID, creates the folder, and places your KMZ file with the matching name. DJI Fly picks it up as a new mission entry.

## Examples

Upload a mission to the only connected controller:

```bash
npx droneroute my-survey.kmz
```

If multiple controllers are connected, an interactive prompt appears:

```
$ npx droneroute my-survey.kmz

Searching for DJI controllers...

Multiple DJI controllers found. Select one:
❯ DJI RC 2 (adb: 3A2F4B1C)
  SD card (/Volumes/DJI_RC)

Uploading my-survey.kmz...
✓ Mission uploaded successfully
  Mission ID: 550E8400-E29B-41D4-A716-446655440000

Open DJI Fly on the controller and look for the new
mission in the waypoint list.
```

## Troubleshooting

| Problem                             | Solution                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| "No DJI controllers found"          | Connect the controller via USB and power it on. Ensure the cable supports data transfer (not charge-only).         |
| adb not found                       | Install Android platform-tools: `brew install android-platform-tools` (macOS) or `apt install adb` (Linux).        |
| Permission denied on waypoint path  | Enable USB debugging on the controller: Settings > Developer Options > USB Debugging.                              |
| Controller not detected by adb      | Try a different USB cable or port. Enable "File Transfer" mode when the USB dialog appears on the controller.      |
| Mission doesn't appear in DJI Fly   | Open the waypoint mission list and scroll — new missions appear at the end. Tap on it to load it into the editor.  |
| Route not listed in DJI Fly         | Save a placeholder route in DJI Fly and run again with `--replace` (see above).                                    |
| DJI RC 2 not found                  | It has no USB debugging. Use MTP: open it in the file manager (Linux), `--dir`, or `--out` (macOS / Windows).      |
| SD card method: directory not found | The waypoint directory is only created after you save at least one waypoint mission via DJI Fly on the controller. |

## License

MIT
