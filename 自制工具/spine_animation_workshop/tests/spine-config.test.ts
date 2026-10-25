import assert from "node:assert/strict";
import { test } from "node:test";
import { readWorkshopConfig, validateSpineConfig } from "../src/config/spine-config.ts";
import { config as glbConfig } from "./transfer-fixtures.ts";

function fixture(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    sourceKind: "spine",
    source: { jsonFile: "rhiny.json", atlasFile: "rhiny.atlas", pageFiles: ["rhiny.png"], skeletonFingerprint: "fnv1a64:source", fileHash: "fnv1a64:file-a" },
    target: { jsonFile: "rozeul.json", atlasFile: "rozeul.atlas", pageFiles: ["rozeul.png"], skeletonFingerprint: "fnv1a64:target", fileHash: "fnv1a64:file-b" },
    sourceDirection: "Z",
    targetDirection: "Z",
    sourceSkin: "default",
    targetSkin: "default",
    targetDisplayAnimation: "Z_direction",
    objectMappings: [
      { kind: "bone", source: "a_arm", target: "Rarm_ik", side: "right", drive: "ik-target", channels: ["translate", "rotate"] },
      { kind: "attachment", source: "sword", target: "weapon", sourceSkin: "default", sourceSlot: "a_hand", targetSkin: "default", targetSlot: "Z-hand", side: "right", drive: "direct" },
    ],
    calibration: { rootScaleX: 1, rootScaleY: 1, corrections: [{ kind: "bone", target: "Rarm_ik", channel: "translate", offsetX: 2, offsetY: -1 }] },
    animationJobs: [
      { sourceAnimation: "atk1", rangeSeconds: [0, 1.2], outputName: "spw02/atk1", corrections: [] },
      { sourceAnimation: "atk2", rangeSeconds: [0, 1.5], outputName: "spw02/atk2", corrections: [{ kind: "bone", target: "Rarm_ik", channel: "rotate", rotationDegrees: 2 }] },
    ],
    channelPolicies: [{ kind: "attachment", source: "sword", sourceSkin: "default", sourceSlot: "a_hand", channel: "deform", decision: "unsupported", reason: "different mesh topology" }],
  };
}

test("loads v2 Spine config with character mapping and separate action corrections", () => {
  const input = fixture();
  const output = validateSpineConfig(input);
  assert.deepEqual(output, input);
  assert.equal(output.objectMappings[1]?.kind, "attachment");
  assert.equal(output.animationJobs.length, 2);
  assert.equal(output.animationJobs[0]?.corrections.length, 0);
  assert.equal(output.animationJobs[1]?.corrections.length, 1);
  assert.deepEqual(readWorkshopConfig(input), input);
});

test('optional direction notes do not block a fresh single-direction migration', () => {
  const input = fixture(); input.sourceDirection = ''; input.targetDirection = '';
  assert.doesNotThrow(() => validateSpineConfig(input));
});

test('draft scope and an explicitly selected empty destination survive config reload', () => {
  const input = fixture() as Record<string, any>;
  input.draftScope = 'body';
  input.animationJobs[0].targetEmptyAnimation = 'blank_attack';
  input.animationJobs[0].outputName = 'blank_attack';
  assert.deepEqual(validateSpineConfig(input), input);
  input.draftScope = 'invalid';
  assert.throws(() => validateSpineConfig(input), /draftScope/);
  input.draftScope = 'mapped'; input.animationJobs[0].outputName = 'different';
  assert.throws(() => validateSpineConfig(input), /空动画|targetEmptyAnimation/);
});

test("reads an unchanged v1 GLB config by explicit schema dispatch", () => {
  const input = glbConfig();
  const output = readWorkshopConfig(input);
  assert.deepEqual(output, input);
  assert.equal(output.schemaVersion, 1);
  assert.equal("sourceKind" in output, false);
});

test("rejects cross-mode, malformed identity, mapping context and action range", () => {
  const wrongMode = fixture();
  wrongMode.sourceKind = "glb";
  assert.throws(() => readWorkshopConfig(wrongMode), /sourceKind|spine/);
  const wrongFingerprint = fixture() as Record<string, any>;
  wrongFingerprint.source.skeletonFingerprint = "";
  assert.throws(() => validateSpineConfig(wrongFingerprint), /skeletonFingerprint/);
  const noAttachmentSlot = fixture() as Record<string, any>;
  delete noAttachmentSlot.objectMappings[1].sourceSlot;
  assert.throws(() => validateSpineConfig(noAttachmentSlot), /sourceSlot/);
  const badRange = fixture() as Record<string, any>;
  badRange.animationJobs[0].rangeSeconds = [1, 0.5];
  assert.throws(() => validateSpineConfig(badRange), /rangeSeconds|时间范围/);
  const noReason = fixture() as Record<string, any>;
  noReason.channelPolicies[0].reason = "";
  assert.throws(() => validateSpineConfig(noReason), /reason/);
});

test("action-scoped channel policies validate the selected animation name", () => {
  const scoped = fixture() as Record<string, any>;
  scoped.channelPolicies[0].sourceAnimation = "atk1";
  assert.deepEqual(validateSpineConfig(scoped), scoped);
  scoped.channelPolicies[0].sourceAnimation = "";
  assert.throws(() => validateSpineConfig(scoped), /sourceAnimation/);
  const duplicate = fixture() as Record<string, any>;
  duplicate.channelPolicies.push(structuredClone(duplicate.channelPolicies[0]));
  assert.throws(() => validateSpineConfig(duplicate), /[Dd]uplicate.*policy/);
});

test("saved action accepts target-authored draw order and rejects invalid layer keys", () => {
  const configured = fixture() as Record<string, any>;
  configured.animationJobs[0].targetDrawOrderKeys = [
    { time: 0, offsets: [{ slot: "Z-Z_Lhand1", offset: 16 }, { slot: "Z-Z_Larm2", offset: 14 }] },
    { time: 0.18333334, offsets: [{ slot: "Z-Z_Lhand1", offset: 16 }] },
    { time: 0.21666667 },
  ];
  assert.deepEqual(readWorkshopConfig(configured), configured);
  const duplicate = structuredClone(configured);
  duplicate.animationJobs[0].targetDrawOrderKeys[0].offsets.push({ slot: "Z-Z_Lhand1", offset: 15 });
  assert.throws(() => validateSpineConfig(duplicate), /targetDrawOrderKeys.*duplicate|duplicate.*slot/i);
  const outOfRange = structuredClone(configured);
  outOfRange.animationJobs[0].targetDrawOrderKeys[1].time = 1.3;
  assert.throws(() => validateSpineConfig(outOfRange), /targetDrawOrderKeys.*range/i);
  const noninteger = structuredClone(configured);
  noninteger.animationJobs[0].targetDrawOrderKeys[0].offsets[0].offset = 1.5;
  assert.throws(() => validateSpineConfig(noninteger), /targetDrawOrderKeys.*integer/i);
});
