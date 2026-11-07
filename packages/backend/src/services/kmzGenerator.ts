import JSZip from "jszip";
import type { Mission } from "@droneroute/shared";
import { buildTemplateKml, buildWaylinesWpml } from "../lib/wpml.js";

// Same KMZ layout as before (template.kml, waylines.wpml, empty res/ at the root), built with
// JSZip, which the importer already uses. This removes archiver and its glob/minimatch chain.
export async function generateKmzBuffer(mission: Mission): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("template.kml", buildTemplateKml(mission));
  zip.file("waylines.wpml", buildWaylinesWpml(mission));
  zip.folder("res");
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}
