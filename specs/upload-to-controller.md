# Upload to controller

Send a mission file directly to a DJI controller connected to your computer.

## What you can do

- Upload a KMZ mission file to a USB-connected DJI remote controller.
- Auto-detect connected controllers.
- Choose which controller to upload to if more than one is connected.
- Upload to a controller without USB debugging (DJI RC 2, RC-N3) over MTP file transfer.
- Point the tool at a mounted controller folder with `--dir <path>`.
- Export a ready mission folder with `--out <folder>` and copy it by hand.
- Replace a placeholder route with `--replace [uuid]` when DJI Fly does not list new routes: pick the
  placeholder from a list (newest first) or name its id. The original file is backed up first.

## How it works

1. Connect your DJI remote controller to your computer via USB.
2. Open a terminal and run `npx droneroute mission.kmz` (replacing `mission.kmz` with your file name).
3. The tool detects the controller and uploads the mission.
4. The mission appears as a new route on the controller, ready to fly.

## Good to know

- This is a command-line tool — you run it from the terminal, not from the web app.
- The tool can detect controllers connected via USB storage mode or via ADB (Android Debug Bridge).
- If multiple controllers are connected, you'll be asked to choose one.
- On Linux, controllers opened in the file manager (MTP via GVFS) are found automatically.
- On macOS and Windows, MTP controllers are not mounted as drives: use `--out` and copy the
  created folder to `Android/data/dji.go.v5/files/waypoint/` with File Explorer or OpenMTP.
- If DJI Fly does not show an uploaded route, save a short placeholder route in DJI Fly and run the tool
  again with `--replace`. The placeholder's original KMZ is kept in `~/.droneroute/backups/`.
- DJI Fly keeps routes in internal storage. Create one route in DJI Fly first so the waypoint
  folder exists.
