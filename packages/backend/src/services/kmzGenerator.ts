import JSZip from "jszip";
import type { Mission } from "@droneroute/shared";
import { buildTemplateKml, buildWaylinesWpml } from "../lib/wpml.js";

// DJI WPML layout as written by DJI Pilot 2 and FlightHub 2: everything inside a wpmz/ folder
// (wpmz/template.kml, wpmz/waylines.wpml, optional wpmz/res/). The importer reads both this and
// the older root layout.
export const KMZ_DIR = "wpmz";

export async function generateKmzBuffer(mission: Mission): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(`${KMZ_DIR}/template.kml`, buildTemplateKml(mission));
  zip.file(`${KMZ_DIR}/waylines.wpml`, buildWaylinesWpml(mission));
  zip.folder(`${KMZ_DIR}/res`);
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}
