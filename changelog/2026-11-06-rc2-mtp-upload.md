## Summary

The CLI can upload missions to controllers without USB debugging, such as the
DJI RC 2 (fixes #53).

## Changes

- Linux: detect controllers mounted over MTP by GVFS
  (`/run/user/<uid>/gvfs/mtp:host=…`), including the storage level such as
  "Internal shared storage".
- New `--dir <path>` option: upload to controller storage mounted anywhere
  (jmtpfs, simple-mtpfs, a file manager mount). It accepts the storage root, the
  device folder above it, or the waypoint folder itself.
- New `--out <folder>` option: write the ready `<UUID>/<UUID>.KMZ` mission folder
  locally so it can be copied with File Explorer (Windows) or OpenMTP (macOS).
- Better troubleshooting text when no controller is found (MTP, internal storage,
  creating a first route in DJI Fly).
- Files are copied with read/write instead of `copyFile` for FUSE mounts.
- First CLI tests (vitest) for folder detection and mission export.
