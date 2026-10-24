import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { TransferConfig } from "../src/core/contracts.ts";
import { loadConfig, saveConfig } from "../src/config/workshop-config.ts";

const sample: TransferConfig = {
  schemaVersion: 1,
  source: {
    file: "C:/samples/CesiumMan.glb",
    clipId: "0",
    frontAxis: "+X",
    upAxis: "+Z",
    rangeSeconds: [0.2, 1.8],
    referenceSeconds: 0.1,
  },
  target: {
    file: "C:/characters/rozeul.spine",
    skin: "default",
    directionId: "rozeul-Z",
    displayAnimation: "common/idle",
  },
  view: { yawDegrees: 45, pitchDegrees: 5, mirror: false },
  anchors: {
    sourceFootPath: "Z_UP/Armature/leg_joint_R_5",
    sourceRootPath: "Z_UP/Armature/Skeleton_torso_joint_1",
    targetFootBone: "Rfoot",
    scale: 800,
    offsetX: 12,
    offsetY: -9,
  },
  mappings: [{ sourcePath: "a/b", sourceEndPath: "a/b/c", target: "Rarm1", mode: "fk-bone", side: "right" }],
  chainCorrections: [{ target: "Rarm1", rotationDegrees: 3, offsetX: 1 }],
  rootPolicy: "in-place-ground",
  sampleHz: 30,
  output: { animationName: "workshop/cesium-Z_001", directory: "C:/out", spineVersion: "4.3.26" },
};

const testOutput = join(process.cwd(), ".cache", "tests");
mkdirSync(testOutput, { recursive: true });

test("saved calibration restores every setting after reopening", () => {
  const dir = mkdtempSync(join(testOutput, "spw01-config-"));
  const file = join(dir, "calibration.json");
  saveConfig(file, sample);
  const loaded = loadConfig(file);
  assert.deepEqual(loaded, sample);
  assert.equal(JSON.parse(readFileSync(file, "utf8")).source.clipId, "0");
});

test("unsupported config version and invalid angles have actionable errors", () => {
  const dir = mkdtempSync(join(testOutput, "spw01-invalid-"));
  const file = join(dir, "bad.json");
  writeFileSync(file, JSON.stringify({ ...sample, schemaVersion: 2 }));
  assert.throws(() => loadConfig(file), /版本|schemaVersion/);
  writeFileSync(file, JSON.stringify({ ...sample, view: { ...sample.view, yawDegrees: "east" } }));
  assert.throws(() => loadConfig(file), /水平角|yawDegrees/);
});
