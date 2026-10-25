import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { AnimationState, AnimationStateData, AtlasAttachmentLoader, Physics, Skeleton, SkeletonJson, TextureAtlas } from "@esotericsoftware/spine-webgl";
import type { SpineObjectMapping } from "../src/core/spine-contracts.ts";
import { appendDirectAnimation } from "../src/output/spine43-direct.ts";
import { createSpineDraft } from "../src/transfer/spine-draft.ts";
import { knownSpinePairs } from "../src/transfer/spine-known-pairs.ts";

function fixture() {
  const source = {
    skeleton: { spine: "4.3.26" },
    bones: [{ name: "root" }, { name: "arm", parent: "root" }, { name: "hair", parent: "root" }],
    slots: [{ name: "shirt", bone: "root" }],
    constraints: [{ type: "ik", name: "sourceIK", bones: ["arm"], target: "root", mix: 1 }],
    skins: [{ name: "default", attachments: { shirt: { cloth: {} } } }],
    events: { hit: {} },
    animations: { attack: {
      bones: { arm: { rotate: [{ value: 10 }, { time: 1, value: 80 }] },
        hair: { rotate: [{ value: 3 }, { time: 1, value: 6 }] } },
      slots: { shirt: { attachment: [{ name: "cloth" }] } },
      attachments: { default: { shirt: { cloth: { deform: [{ vertices: [0, 1] }] } } } },
      drawOrder: [{ offsets: [{ slot: "shirt", offset: 0 }] }],
      events: [{ name: "hit" }],
      ik: { sourceIK: [{ mix: 1 }] },
    } },
  };
  const target = {
    skeleton: { spine: "4.3.26" },
    bones: [{ name: "root" }, { name: "hand", parent: "root" }, { name: "other", parent: "root" }],
    slots: [] as { name: string; bone: string }[],
    constraints: [] as { type: string; name: string; bones: string[]; target: string; mix: number }[],
    skins: [{ name: "default", attachments: {} }], events: {},
    animations: { idle: { bones: { root: { rotate: [{ value: 2 }] } } } },
  };
  const mappings: SpineObjectMapping[] = [{ kind: "bone", source: "arm", target: "hand", side: "unknown", drive: "fk-bone" }];
  return { source, target, mappings };
}

test("body draft previews mapped motion while clothing, hair and unsupported keys remain omitted", () => {
  const { source, target, mappings } = fixture();
  const before = structuredClone({ source, target });
  const result = createSpineDraft(source, target, "attack", mappings);
  assert.deepEqual(result.animation, { bones: { hand: { rotate: [{ value: 10 }, { time: 1, value: 80 }] } } });
  assert.equal(result.copied, 1);
  assert.equal(result.omitted, 6);
  assert.equal(result.scope, "body");
  assert.equal(result.report.channels.find((row) => row.source === "hair")?.status, "unmapped");
  assert.equal(result.report.channels.find((row) => row.kind === "attachment")?.status, "explicit-skip");
  assert.equal(result.report.blocked, true, "unmapped channels must remain visible in the audit");
  assert.deepEqual({ source, target }, before);
});

test("editing a mapping or correction refreshes only the draft and preserves target animations", () => {
  const { source, target, mappings } = fixture();
  const first = createSpineDraft(source, target, "attack", mappings);
  const second = createSpineDraft(source, target, "attack", [{ ...mappings[0]!, target: "other" }],
    [{ kind: "bone", target: "other", channel: "rotate", rotationDegrees: 5 }]);
  assert.deepEqual(first.animation, { bones: { hand: { rotate: [{ value: 10 }, { time: 1, value: 80 }] } } });
  assert.deepEqual(second.animation, { bones: { other: { rotate: [{ value: 15 }, { time: 1, value: 85 }] } } });
  assert.deepEqual(target.animations, { idle: { bones: { root: { rotate: [{ value: 2 }] } } } });
});

test("mapped draft omits conflicting destinations without dropping independent safe channels", () => {
  const { source, target, mappings } = fixture();
  const conflict: SpineObjectMapping[] = [...mappings,
    { kind: "bone", source: "hair", target: "hand", side: "unknown", drive: "fk-bone" }];
  (source.animations.attack.bones as Record<string, unknown>).root = { rotate: [{ value: 4 }] };
  conflict.push({ kind: "bone", source: "root", target: "root", side: "center", drive: "direct" });
  const result = createSpineDraft(source, target, "attack", conflict, [], [], undefined, undefined, undefined, "mapped");
  assert.deepEqual(result.animation, { bones: { root: { rotate: [{ value: 4 }] } } });
  assert.equal(result.report.channels.filter((row) => row.status === "conflict" && row.kind === "bone").length, 2);
  assert.equal(result.report.channels.find((row) => row.kind === "attachment")?.status, "unsupported");
  assert.equal(result.copied, 1);
});

test("a mapping marked skip omits its bone without persisting generated skip policies", () => {
  const { source, target, mappings } = fixture();
  const policies: import("../src/core/spine-contracts.ts").SpineChannelPolicy[] = [];
  const result = createSpineDraft(source, target, "attack", [{ ...mappings[0]!, drive: "skip" }], [], policies);
  assert.deepEqual(result.animation, {});
  assert.equal(result.report.channels.find((row) => row.source === "arm")?.status, "explicit-skip");
  assert.equal(policies.length, 0);
  assert.equal(result.copied, 0);
  assert.equal(result.report.blocked, true);
});

test("mapped FK draft writes IK-off keys so the real target setup cannot override copied motion", () => {
  const { source, target, mappings } = fixture();
  target.constraints.push({ type: "ik", name: "targetIK", bones: ["hand"], target: "root", mix: 1 });
  mappings.push({ kind: "ik", source: "sourceIK", target: "targetIK", side: "unknown", drive: "ik-target" });
  const result = createSpineDraft(source, target, "attack", mappings, [], [], undefined, undefined, undefined, "mapped");
  assert.deepEqual((result.animation.bones as any).hand.rotate, [{ value: 10 }, { time: 1, value: 80 }]);
  assert.deepEqual(result.animation.ik, { targetIK: [{ mix: 0 }] });
  assert.deepEqual(result.disabledIk, ["targetIK"]);
  assert.equal(result.report.channels.find((row) => row.kind === "ik")?.status, "explicit-skip");
  assert.ok(result.report.warnings.some((warning) => warning.includes("targetIK")));
  assert.equal(target.constraints[0]!.mix, 1);
  assert.equal(result.copied, 1, "target-authored IK off must not count as source motion copied");
});

test("conflicting FK rows do not disable the target IK solver", () => {
  const { source, target } = fixture();
  target.constraints.push({ type: "ik", name: "targetIK", bones: ["hand"], target: "root", mix: 1 });
  const mappings: SpineObjectMapping[] = [
    { kind: "bone", source: "arm", target: "hand", side: "left", drive: "fk-bone" },
    { kind: "bone", source: "hair", target: "hand", side: "left", drive: "fk-bone" },
    { kind: "ik", source: "sourceIK", target: "targetIK", side: "unknown", drive: "ik-target" },
  ];
  const result = createSpineDraft(source, target, "attack", mappings, [], [], undefined, undefined, undefined, "mapped");
  assert.deepEqual(result.disabledIk, []);
  assert.equal(result.animation.bones, undefined);
  assert.notDeepEqual(result.animation.ik, { targetIK: [{ mix: 0 }] });
});

test("target-authored draw order takes precedence over a mapped source layer timeline in a draft", () => {
  const { source, target, mappings } = fixture();
  target.slots.push({ name: "targetShirt", bone: "root" });
  mappings.push({ kind: "slot", source: "shirt", target: "targetShirt", side: "unknown", drive: "direct" });
  const authored = [{ time: 0.25, offsets: [{ slot: "targetShirt", offset: 0 }] }];
  const result = createSpineDraft(source, target, "attack", mappings, [], [], undefined, undefined, authored, "mapped");
  assert.deepEqual(result.animation.drawOrder, authored);
  assert.equal(result.report.channels.find((row) => row.kind === "drawOrder")?.status, "explicit-skip");
  assert.equal(source.animations.attack.drawOrder[0]!.offsets[0]!.slot, "shirt");
});

test("empty mapping is an empty draft with zero copied channels and an incomplete report", () => {
  const { source, target } = fixture();
  const result = createSpineDraft(source, target, "attack", []);
  assert.deepEqual(result.animation, {});
  assert.equal(result.copied, 0);
  assert.equal(result.omitted, 7);
  assert.equal(result.report.blocked, true);
  assert.ok(result.report.channels.some((row) => row.channel === "@empty"));
});

test("malformed documents and unsupported crop ranges cannot become plausible drafts", () => {
  const { source, target, mappings } = fixture();
  assert.throws(() => createSpineDraft(source, target, "attack", mappings, [], [], [0.2, 0.8]), /range|crop/i);
  assert.throws(() => createSpineDraft(source, target, "missing", mappings), /missing/i);
  assert.throws(() => createSpineDraft(source, { ...target, bones: [] }, "attack", mappings), /bones/i);
  const malformed = structuredClone(source);
  (malformed.animations.attack.bones.arm.rotate[0] as { time?: number }).time = -1;
  assert.throws(() => createSpineDraft(malformed, target, "attack", mappings), /time|nonnegative/i);
});

const rhinyJson = fileURLToPath(new URL("../../../work/SPW-02/asset-audit/rhiny/rhiny.json", import.meta.url));
const rozeulJson = fileURLToPath(new URL("../../../work/SPW-02/asset-audit/rozeul/rozeul.json", import.meta.url));
const rozeulAtlas = fileURLToPath(new URL("../../../work/SPW-02/asset-audit/rozeul/rozeul.atlas", import.meta.url));
test("real attack body draft loads and moves in the official runtime despite unmatched hair and clothing", {
  skip: ![rhinyJson, rozeulJson, rozeulAtlas].every(existsSync),
}, () => {
  const source = JSON.parse(readFileSync(rhinyJson, "utf8"));
  const target = JSON.parse(readFileSync(rozeulJson, "utf8"));
  const result = createSpineDraft(source, target, "atk1", knownSpinePairs[0]!.mappings);
  assert.ok(result.copied > 5);
  assert.ok(result.omitted > 0);
  assert.ok(result.disabledIk.length > 0);
  const appended = appendDirectAnimation(target, result.animation, "attack_draft");
  const atlas = new TextureAtlas(readFileSync(rozeulAtlas, "utf8"));
  const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(appended.jsonText);
  const pose = (time: number) => {
    const skeleton = new Skeleton(data);
    skeleton.setupPose();
    const state = new AnimationState(new AnimationStateData(data));
    state.setAnimation(0, appended.name, false);
    state.update(time);
    state.apply(skeleton);
    skeleton.updateWorldTransform(Physics.reset);
    return skeleton.bones.flatMap((bone) => [bone.appliedPose.worldX, bone.appliedPose.worldY, bone.appliedPose.a, bone.appliedPose.c]);
  };
  const start = pose(0), later = pose(0.5);
  assert.ok(start.every(Number.isFinite) && later.every(Number.isFinite));
  assert.ok(start.some((value, index) => Math.abs(value - later[index]!) > 1e-4));
  assert.equal(target.animations.attack_draft, undefined);
});
