## Summary

The CLI can replace a placeholder route for DJI Fly versions that only list
routes they created themselves (follow-up to #53).

## Changes

- New `-r, --replace [uuid]` option: lists the existing DJI Fly routes on the
  controller (mounted, MTP or adb), newest first, and overwrites the chosen
  placeholder's KMZ. `--replace <uuid>` selects the route directly; without a
  terminal the tool lists the routes and asks for the id.
- The original KMZ is saved to `~/.droneroute/backups/` before it is replaced.
- `--out <folder> --replace <uuid>` writes the mission folder under the
  placeholder's id for a manual copy on macOS and Windows.
- The upload message points to `--replace` if the route does not appear.
- Tests for route listing, adb `stat` parsing and replacing.
