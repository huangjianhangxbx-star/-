import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { extractDisplayInfo, readSpineTarget } from "../src/target/spine-target.ts";

const realJsonPath = fileURLToPath(
  new URL("../../../work/SPW-01/inputs/rozeul/packed/rozeul.json", import.meta.url),
);

test("reads the current Spine 4.3 target without dropping its document", {
  skip: !existsSync(realJsonPath),
}, () => {
  const source = readFileSync(realJsonPath, "utf8");
  const { summary, document } = readSpineTarget(source);
  assert.equal(summary.editorVersion, "4.3.26");
  assert.equal(summary.bones.length, 169);
  assert.equal(summary.skins.length, 1);
  assert.equal(summary.animations.length, 110);
  assert.equal(summary.constraints.filter((item) => item.kind === "ik").length, 5);
  assert.equal(summary.constraints.filter((item) => item.kind === "transform").length, 36);
  assert.ok(summary.bones.some((bone) => bone.name === "RlegIK_hips" && bone.parent === "flip"));
  assert.deepEqual(document, JSON.parse(source));
});

test("normalizes omitted setup values and preserves unknown JSON fields", () => {
  const raw = {
    skeleton: { spine: "4.3.26", custom: { keep: true } },
    bones: [{ name: "root" }, { name: "arm", parent: "root", x: 2, scaleY: -1 }],
    constraints: [{ type: "ik", name: "arm_ik", bones: ["arm"], target: "root" }],
    skins: [{ name: "default", attachments: { slot: { body: { type: "mesh", vertices: [1, 2] } } } }],
    animations: { idle: { bones: { arm: { rotate: [{ value: 3 }] } } } },
    futureField: { untouched: [1, 2, 3] },
  };
  const { summary, document } = readSpineTarget(JSON.stringify(raw));
  assert.deepEqual(summary.bones[0], {
    name: "root", parent: null, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 0,
  });
  assert.equal(summary.bones[1]?.scaleY, -1);
  assert.deepEqual(summary.constraints[0], {
    kind: "ik", name: "arm_ik", bones: ["arm"], target: "root", source: null,
  });
  assert.deepEqual(document, raw);
});

test("rejects incompatible versions and invalid bone references", () => {
  assert.throws(() => readSpineTarget(JSON.stringify({ skeleton: { spine: "4.2.40" }, bones: [{ name: "root" }] })), /4\.3/);
  assert.throws(() => readSpineTarget(JSON.stringify({ skeleton: { spine: "4.3.26" }, bones: [{ name: "arm", parent: "missing" }] })), /missing/);
});

test("reports a missing atlas page by name when resource evidence is supplied", () => {
  const source = JSON.stringify({ skeleton: { spine: "4.3.26" }, bones: [{ name: "root" }] });
  const atlasText = "hero.png\nsize:32,32\nfilter:Linear,Linear\nbody\nbounds:0,0,8,8\n";
  assert.doesNotThrow(() => readSpineTarget(source, { atlasText, availablePageNames: ["hero.png"] }));
  assert.throws(() => readSpineTarget(source, { atlasText, availablePageNames: [] }), /hero\.png/);
});

test("exposes setup slots and attachment prefix hints without assuming five directions", {
  skip: !existsSync(realJsonPath),
}, () => {
  const { document } = readSpineTarget(readFileSync(realJsonPath, "utf8"));
  const display = extractDisplayInfo(document);
  assert.equal(display.slots.length, 88);
  assert.deepEqual(display.skins, [{ name: "default", slotCount: 85, attachmentCount: 158 }]);
  assert.deepEqual(display.candidateDirectionPrefixes, [
    { prefix: "Z", attachmentCount: 134, visibleSetupSlots: 67 },
    { prefix: "B", attachmentCount: 19, visibleSetupSlots: 0 },
    { prefix: "C", attachmentCount: 5, visibleSetupSlots: 0 },
  ]);
  assert.ok(display.slots.some((slot) => slot.name === "Z-body" && slot.attachment === "Z/body"));
});
