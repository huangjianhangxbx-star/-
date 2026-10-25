import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { readSpineSource } from "../src/source/spine-source.ts";

function fixture(): Record<string, unknown> {
  return {
    skeleton: { spine: "4.3.26", hash: "editor-generated" },
    bones: [
      { name: "root" },
      { name: "arm", parent: "root", x: 2, rotation: 10, scaleY: -1 },
    ],
    slots: [{ name: "hand", bone: "arm", attachment: "sword" }],
    constraints: [{ type: "ik", name: "armIK", bones: ["arm"], target: "root", mix: 0.5 }],
    skins: [{ name: "default", attachments: { hand: {
      sword: { type: "mesh", vertices: [0, 1, 2, 3], triangles: [0, 1, 2] },
    } } }],
    events: { hit: { int: 1 } },
    animations: { wave: {
      bones: { arm: { rotate: [{ value: 0 }, { time: 0.25, value: 45, curve: [0.1, 0.2, 0.3, 0.4] }] } },
      slots: { hand: { attachment: [{ name: "sword" }, { time: 0.5, name: null }] } },
      ik: { armIK: [{ mix: 1 }, { time: 0.75, mix: 0.5 }] },
      attachments: { default: { hand: { sword: { deform: [{ time: 0.9, vertices: [1, 2] }] } } } },
      drawOrder: [{ time: 1, offsets: [{ slot: "hand", offset: 0 }] }],
      events: [{ time: 1.2, name: "hit" }],
    } },
  };
}

test("reads Spine 4.3 animation durations and exact keyed dependencies", () => {
  const input = fixture();
  const result = readSpineSource(JSON.stringify(input));
  assert.deepEqual(result.document, input);
  assert.equal(result.summary.editorVersion, "4.3.26");
  assert.equal(result.summary.bones[1]?.scaleY, -1);
  assert.deepEqual(result.summary.animations, [{ name: "wave", durationSeconds: 1.2 }]);
  assert.deepEqual(result.animationDependencies.wave.map(({ kind, source, channel, sourceSkin, sourceSlot }) =>
    [kind, source, channel, sourceSkin ?? null, sourceSlot ?? null]), [
    ["bone", "arm", "rotate", null, null],
    ["slot", "hand", "attachment", null, null],
    ["ik", "armIK", "ik", null, null],
    ["attachment", "sword", "deform", "default", "hand"],
    ["drawOrder", "@drawOrder", "drawOrder", null, null],
    ["event", "hit", "event", null, null],
  ]);
  assert.equal(result.animationDependencies.wave[0]?.keyCount, 2);
  assert.equal(result.animationDependencies.wave.at(-1)?.lastKeySeconds, 1.2);
});

test("keeps the skeleton fingerprint when only animations change and keeps file identity separate", () => {
  const original = fixture();
  const changed = structuredClone(original) as Record<string, unknown>;
  changed.animations = { another: { bones: { arm: { rotate: [{ time: 2, value: 90 }] } } } };
  const a = readSpineSource(JSON.stringify(original)).summary;
  const b = readSpineSource(JSON.stringify(changed)).summary;
  assert.equal(a.skeletonFingerprint, b.skeletonFingerprint);
  assert.notEqual(a.fileHash, b.fileHash);

  const changedSetup = structuredClone(original) as Record<string, any>;
  changedSetup.bones[1].x = 3;
  assert.notEqual(readSpineSource(JSON.stringify(changedSetup)).summary.skeletonFingerprint, a.skeletonFingerprint);

  const changedAttachment = structuredClone(original) as Record<string, any>;
  changedAttachment.skins[0].attachments.hand.shield = { type: "region" };
  assert.notEqual(readSpineSource(JSON.stringify(changedAttachment)).summary.skeletonFingerprint, a.skeletonFingerprint);
});

test("rejects malformed Spine input, duplicate names and broken references", () => {
  assert.throws(() => readSpineSource("not JSON"), /JSON/);
  const wrongVersion = fixture() as Record<string, any>;
  wrongVersion.skeleton.spine = "3.8.99";
  assert.throws(() => readSpineSource(JSON.stringify(wrongVersion)), /4\.3/);
  const duplicateBone = fixture() as Record<string, any>;
  duplicateBone.bones.push({ name: "arm" });
  assert.throws(() => readSpineSource(JSON.stringify(duplicateBone)), /[Dd]uplicate.*arm|重复.*arm/);
  const missingParent = fixture() as Record<string, any>;
  missingParent.bones[1].parent = "missing";
  assert.throws(() => readSpineSource(JSON.stringify(missingParent)), /missing/);
  const duplicateSlot = fixture() as Record<string, any>;
  duplicateSlot.slots.push({ name: "hand", bone: "arm" });
  assert.throws(() => readSpineSource(JSON.stringify(duplicateSlot)), /[Dd]uplicate.*hand|重复.*hand/);
  const missingTarget = fixture() as Record<string, any>;
  missingTarget.constraints[0].target = "missing";
  assert.throws(() => readSpineSource(JSON.stringify(missingTarget)), /missing/);
});

test("checks supplied atlas page images without requiring resources for structural reading", () => {
  const input = JSON.stringify(fixture());
  const atlasText = "hero.png\nsize:32,32\nfilter:Linear,Linear\nsword\nbounds:0,0,8,8\n";
  assert.doesNotThrow(() => readSpineSource(input));
  assert.doesNotThrow(() => readSpineSource(input, { atlasText, availablePageNames: ["hero.png"] }));
  assert.throws(() => readSpineSource(input, { atlasText, availablePageNames: [] }), /hero\.png/);
});

const rhinyPath = fileURLToPath(new URL("../../../work/SPW-02/asset-audit/rhiny/rhiny.json", import.meta.url));
test("reads the current real rhiny export with keyed arm channels", { skip: !existsSync(rhinyPath) }, () => {
  const result = readSpineSource(readFileSync(rhinyPath, "utf8"));
  assert.equal(result.summary.editorVersion, "4.3.26");
  assert.equal(result.summary.bones.length, 235);
  assert.ok(result.summary.animations.length >= 80);
  assert.ok(result.summary.animations.some((item) => item.name === "atk1" && item.durationSeconds > 0));
  assert.ok(result.animationDependencies.atk1?.some((item) => item.kind === "bone" && item.source.startsWith("a_")));
  assert.ok(result.animationDependencies.atk1?.some((item) => item.kind === "attachment" && item.channel === "deform"));
  assert.equal(result.animationDependencies.atk2?.find((item) => item.kind === "slot" && item.source === "a_body2" && item.channel === "attachment")?.chronological, false);
});
