import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeMissionFolder } from "./upload.js";

let tmp: string;

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("writeMissionFolder", () => {
  it("creates <UUID>/<UUID>.KMZ with the file content", () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "droneroute-cli-"));
    const kmz = path.join(tmp, "mission.kmz");
    fs.writeFileSync(kmz, "PK-test");
    const out = path.join(tmp, "out");

    const result = writeMissionFolder(out, kmz);

    expect(result.uuid).toMatch(/^[0-9A-F-]{36}$/);
    expect(result.remotePath).toBe(
      path.join(out, result.uuid, `${result.uuid}.KMZ`),
    );
    expect(fs.readFileSync(result.remotePath, "utf-8")).toBe("PK-test");
  });
});

describe("writeMissionFolder with a placeholder id", () => {
  it("reuses the given UUID", () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "droneroute-cli-"));
    const kmz = path.join(tmp, "mission.kmz");
    fs.writeFileSync(kmz, "PK");
    const uuid = "11111111-2222-3333-4444-555555555555";
    const result = writeMissionFolder(path.join(tmp, "out"), kmz, uuid);
    expect(result.uuid).toBe(uuid);
    expect(result.remotePath).toBe(path.join(tmp, "out", uuid, `${uuid}.KMZ`));
  });
});

describe("writeMissionFolder failure handling", () => {
  it("keeps an existing folder when the write fails", () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "droneroute-cli-"));
    const uuid = "11111111-2222-3333-4444-555555555555";
    const existing = path.join(tmp, uuid);
    fs.mkdirSync(existing);
    // A directory where the KMZ should go makes the write fail.
    fs.mkdirSync(path.join(existing, `${uuid}.KMZ`));
    const kmz = path.join(tmp, "mission.kmz");
    fs.writeFileSync(kmz, "PK");
    expect(() => writeMissionFolder(tmp, kmz, uuid.toLowerCase())).toThrow();
    expect(fs.existsSync(existing)).toBe(true);
  });
});
