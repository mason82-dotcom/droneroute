#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { program } from "commander";
import chalk from "chalk";
import { detectDevices, selectDevice } from "./device.js";
import { uploadKmz, writeMissionFolder } from "./upload.js";
import { findWaypointDir } from "./volumes.js";
import { WAYPOINT_PATH } from "./constants.js";
import { isAdbAvailable } from "./adb.js";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from package.json
const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf-8"),
);

program
  .name("droneroute")
  .description(
    "Upload DJI waypoint mission KMZ files to RC controllers via USB",
  )
  .version(pkg.version)
  .argument("<file>", "path to a .kmz mission file")
  .option(
    "-d, --dir <path>",
    "controller storage mounted at <path> (e.g. via jmtpfs or an MTP file manager)",
  )
  .option(
    "-o, --out <folder>",
    "write the mission folder to <folder> for copying to the controller manually",
  )
  .action(async (file: string, opts: { dir?: string; out?: string }) => {
    // ── Validate the file ───────────────────────────────────────────
    const kmzPath = path.resolve(file);

    if (!fs.existsSync(kmzPath)) {
      console.error(chalk.red(`Error: file "${file}" not found`));
      process.exit(1);
    }

    if (!file.toLowerCase().endsWith(".kmz")) {
      const ext = path.extname(file) || "(none)";
      console.error(chalk.red(`Error: expected a .kmz file, got "${ext}"`));
      process.exit(1);
    }

    if (opts.dir && opts.out) {
      console.error(chalk.red("Error: use either --dir or --out, not both"));
      process.exit(1);
    }

    // ── Export for manual copy (e.g. macOS / Windows with MTP) ───────
    if (opts.out) {
      const outDir = path.resolve(opts.out);
      try {
        const result = writeMissionFolder(outDir, kmzPath);
        console.log(chalk.green("\n✓ Mission folder created"));
        console.log(chalk.dim(`  ${path.dirname(result.remotePath)}`));
        console.log(
          chalk.dim("\nCopy the folder ") +
            result.uuid +
            chalk.dim(" to the controller's internal storage under"),
        );
        console.log(`  ${WAYPOINT_PATH}/`);
        console.log(
          chalk.dim(
            "(Windows: File Explorer, macOS: OpenMTP or Android File Transfer).",
          ),
        );
        console.log(
          chalk.dim(
            "DJI Fly only lists routes in that folder; create one route in DJI Fly first if it is missing.",
          ),
        );
      } catch (err: any) {
        console.error(chalk.red(`\nExport failed: ${err.message}`));
        process.exit(1);
      }
      return;
    }

    // ── Detect controllers ──────────────────────────────────────────
    let devices;
    if (opts.dir) {
      const waypointPath = findWaypointDir(path.resolve(opts.dir));
      if (!waypointPath) {
        console.error(
          chalk.red(`\nNo DJI Fly waypoint folder found under "${opts.dir}".`),
        );
        console.error(
          chalk.dim(
            `Expected ${WAYPOINT_PATH} on the controller storage. Create one route in DJI Fly first so the folder exists.`,
          ),
        );
        process.exit(1);
      }
      devices = [{ type: "mounted" as const, label: opts.dir, waypointPath }];
    } else {
      console.log(chalk.dim("Searching for DJI controllers..."));
      devices = detectDevices();
    }

    if (devices.length === 0) {
      const hasAdb = isAdbAvailable();

      console.error(chalk.red("\nNo DJI controllers found.\n"));
      console.error(chalk.dim("Troubleshooting:"));
      console.error(
        chalk.dim("  • Connect the controller via USB and power it on"),
      );
      console.error(
        chalk.dim(
          '  • DJI RC 2 / RC-N3 have no USB debugging: choose "File transfer" (MTP)',
        ),
      );
      console.error(
        chalk.dim(
          "      Linux:   open the device once in the file manager (GVFS), or mount it and use --dir <path>",
        ),
      );
      console.error(
        chalk.dim(
          "      macOS / Windows: use --out <folder> and copy the folder with OpenMTP / File Explorer",
        ),
      );
      console.error(
        chalk.dim(
          "  • DJI Fly keeps routes in internal storage; create one route first so the waypoint folder exists",
        ),
      );

      if (!hasAdb) {
        console.error(
          chalk.dim("  • Controllers with USB debugging: install adb"),
        );
        console.error(
          chalk.dim("      macOS:   brew install android-platform-tools"),
        );
        console.error(chalk.dim("      Linux:   apt install adb"));
        console.error(
          chalk.dim("      Windows: included with Android SDK platform-tools"),
        );
      } else {
        console.error(
          chalk.dim(
            "  • Controllers with USB debugging: enable it on the controller",
          ),
        );
        console.error(
          chalk.dim("  • Check that the USB cable supports data transfer"),
        );
      }
      process.exit(1);
    }

    // ── Select device ───────────────────────────────────────────────
    const device = await selectDevice(devices);

    console.log(chalk.dim(`\nUsing ${device.label}`));

    // ── Upload ──────────────────────────────────────────────────────
    try {
      console.log(chalk.dim(`Uploading ${path.basename(kmzPath)}...`));

      const result = uploadKmz(device, kmzPath);

      console.log(chalk.green("\n✓ Mission uploaded successfully"));
      console.log(chalk.dim(`  Mission ID: ${result.uuid}`));
      console.log(
        chalk.dim("\nOpen DJI Fly on the controller and look for the new"),
      );
      console.log(chalk.dim("mission in the waypoint list."));
    } catch (err: any) {
      console.error(chalk.red(`\nUpload failed: ${err.message}`));
      console.error(
        chalk.dim("Check that the controller is connected and try again."),
      );
      process.exit(1);
    }
  });

program.parse();
