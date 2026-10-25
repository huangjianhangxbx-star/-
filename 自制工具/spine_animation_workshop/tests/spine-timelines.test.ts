import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { AnimationState, AnimationStateData, AtlasAttachmentLoader, Physics, Skeleton, SkeletonJson, TextureAtlas } from "@esotericsoftware/spine-webgl";
import type { SpineChannelPolicy, SpineObjectMapping } from "../src/core/spine-contracts.ts";
import { appendDirectAnimation } from "../src/output/spine43-direct.ts";
import { readSpineSource } from "../src/source/spine-source.ts";
import { migrateSpineAnimation } from "../src/transfer/spine-timelines.ts";

function fixture() {
  const source = {
    skeleton: { spine: "4.3.26" },
    bones: [{ name: "root" }, { name: "upper", parent: "root" }, { name: "forearm", parent: "upper" }],
    slots: [{ name: "hand", bone: "forearm", attachment: "open" }],
    constraints: [{ type: "ik", name: "armIK", bones: ["upper", "forearm"], target: "root", mix: 0 }],
    skins: [{ name: "default", attachments: { hand: { open: {}, fist: {} } } }],
    events: { hit: {} },
    animations: { wave: {
      bones: {
        upper: { rotate: [{ value: 0, curve: [0.2, 10, 0.7, 40] }, { time: 1, value: 60 }],
          translate: [{ x: 2, y: 3 }, { time: 1, x: 4, y: 5 }],
          scale: [{ x: 1, y: 1.2 }], shear: [{ x: 5, y: 8 }] },
        forearm: { rotate: [{ value: -350 }, { time: 1, value: 25 }] },
      },
      slots: { hand: { attachment: [{ name: "open" }, { time: 0.5, name: "fist" }] } },
      ik: { armIK: [{ mix: 0 }] },
      drawOrder: [{ time: 0.5, offsets: [{ slot: "hand", offset: 0 }] }],
      events: [{ time: 0.7, name: "hit" }],
      future: { unknown: [{ time: 1, value: 1 }] },
    } },
  };
  const target = {
    skeleton: { spine: "4.3.26" },
    bones: [{ name: "root" }, { name: "Larm1", parent: "root" }, { name: "Larm2", parent: "Larm1" }],
    slots: [{ name: "Z-hand", bone: "Larm2", attachment: "Z/open" }],
    constraints: [{ type: "ik", name: "targetIK", bones: ["Larm1", "Larm2"], target: "root", mix: 0 }],
    skins: [{ name: "default", attachments: { "Z-hand": { "Z/open": {}, "Z/fist": {} } } }],
    events: { hit2: {} },
    animations: { idle: { bones: { root: { rotate: [{ value: 1 }] } } } },
  };
  const mappings: SpineObjectMapping[] = [
    { kind: "bone", source: "upper", target: "Larm1", side: "left", drive: "fk-bone" },
    { kind: "bone", source: "forearm", target: "Larm2", side: "left", drive: "fk-bone" },
    { kind: "slot", source: "hand", target: "Z-hand", side: "left", drive: "direct" },
    { kind: "attachment", source: "open", target: "Z/open", sourceSkin: "default", sourceSlot: "hand", targetSkin: "default", targetSlot: "Z-hand", side: "left", drive: "direct" },
    { kind: "attachment", source: "fist", target: "Z/fist", sourceSkin: "default", sourceSlot: "hand", targetSkin: "default", targetSlot: "Z-hand", side: "left", drive: "direct" },
    { kind: "ik", source: "armIK", target: "targetIK", side: "left", drive: "ik-target" },
    { kind: "event", source: "hit", target: "hit2", side: "unknown", drive: "direct" },
  ];
  return { source, target, mappings };
}

test("copies native key arrays, winding, times and curves exactly when uncorrected", () => {
  const { source, target, mappings } = fixture();
  const policies: SpineChannelPolicy[] = [{ kind: "unknown", source: "future", channel: "unknown", decision: "skip", reason: "Future channel unsupported" }];
  const { animation, report } = migrateSpineAnimation(source, target, "wave", mappings, [], policies);
  assert.equal(report.blocked, false);
  assert.deepEqual((animation.bones as any).Larm1.rotate, source.animations.wave.bones.upper.rotate);
  assert.deepEqual((animation.bones as any).Larm2.rotate, source.animations.wave.bones.forearm.rotate);
  assert.deepEqual((animation.bones as any).Larm1.translate, source.animations.wave.bones.upper.translate);
  assert.deepEqual((animation.slots as any)["Z-hand"].attachment, [
    { name: "Z/open" }, { time: 0.5, name: "Z/fist" },
  ]);
  assert.deepEqual((animation.ik as any).targetIK, [{ mix: 0 }]);
  assert.deepEqual(animation.drawOrder, [{ time: 0.5, offsets: [{ slot: "Z-hand", offset: 0 }] }]);
  assert.deepEqual(animation.events, [{ time: 0.7, name: "hit2" }]);
  assert.equal(report.channels.length, 10);
  assert.equal(report.channels.find((item) => item.kind === "unknown")?.status, "explicit-skip");
  assert.deepEqual(target.animations.idle, { bones: { root: { rotate: [{ value: 1 }] } } });
});

test("local corrections transform value and Bezier Y controls without changing time or X controls", () => {
  const { source, target, mappings } = fixture();
  const { animation } = migrateSpineAnimation(source, target, "wave", mappings, [
    { kind: "bone", target: "Larm1", channel: "rotate", rotationDegrees: 5 },
    { kind: "bone", target: "Larm1", channel: "translate", offsetX: 10, offsetY: -2 },
    { kind: "bone", target: "Larm1", channel: "scale", scaleX: 2, scaleY: 3 },
  ], [{ kind: "unknown", source: "future", channel: "unknown", decision: "skip", reason: "Not portable" }]);
  assert.deepEqual((animation.bones as any).Larm1.rotate, [
    { value: 5, curve: [0.2, 15, 0.7, 45] }, { time: 1, value: 65 },
  ]);
  assert.deepEqual((animation.bones as any).Larm1.translate, [{ x: 12, y: 1 }, { time: 1, x: 14, y: 3 }]);
  assert.equal((animation.bones as any).Larm1.scale[0].x, 2);
  assert.ok(Math.abs((animation.bones as any).Larm1.scale[0].y - 3.6) < 1e-12);
});

test("local translation calibration scales both axes and their Bezier controls", () => {
  const { source, target, mappings } = fixture();
  (source.animations.wave.bones.upper.translate[0]! as any).curve = [0.1, 2.1, 0.2, 2.2, 0.3, 3.1, 0.4, 3.2];
  const { animation, report } = migrateSpineAnimation(source, target, "wave", mappings, [
    { kind: "bone", target: "Larm1", channel: "translate", scaleX: 2, scaleY: 3, offsetX: 10, offsetY: -2 },
  ], [{ kind: "unknown", source: "future", channel: "unknown", decision: "skip", reason: "Not portable" }]);
  assert.equal(report.blocked, false);
  const first = (animation.bones as any).Larm1.translate[0];
  assert.equal(first.x, 14);
  assert.equal(first.y, 7);
  assert.deepEqual(first.curve, [0.1, 14.2, 0.2, 14.4, 0.3, 7.300000000000001, 0.4, 7.600000000000001]);
});

test("invalid attachment, incompatible draw order and unknown category remain visible and block", () => {
  const { source, target, mappings } = fixture();
  delete (target.skins[0]!.attachments["Z-hand"] as any)["Z/fist"];
  target.slots.push({ name: "other", bone: "Larm1", attachment: "open" });
  const { animation, report } = migrateSpineAnimation(source, target, "wave", mappings);
  assert.equal(report.blocked, true);
  assert.equal(report.channels.find((item) => item.kind === "slot")?.status, "conflict");
  assert.equal(report.channels.find((item) => item.kind === "drawOrder")?.status, "conflict");
  assert.equal(report.channels.find((item) => item.kind === "unknown")?.status, "unsupported");
  assert.equal((animation.slots as any)?.["Z-hand"], undefined);
});

test("an attachment mapping marked skip cannot copy its slot key", () => {
  const { source, target, mappings } = fixture();
  const fist = mappings.find((item) => item.kind === "attachment" && item.source === "fist");
  assert.ok(fist);
  fist.drive = "skip";
  const { animation, report } = migrateSpineAnimation(source, target, "wave", mappings);
  const slot = report.channels.find((item) => item.kind === "slot" && item.channel === "attachment");
  assert.equal(slot?.status, "conflict");
  assert.match(slot?.reason ?? "", /mapping|skip/i);
  assert.equal((animation.slots as any)?.["Z-hand"], undefined);
});

test("target-authored layer keys survive source draw order skip without counting as source transfer", () => {
  const { source, target, mappings } = fixture();
  target.slots.push({ name: "Z-body", bone: "root", attachment: "Z/body" });
  (target.skins[0]!.attachments as Record<string, unknown>)["Z-body"] = { "Z/body": {} };
  const policies: SpineChannelPolicy[] = [
    { kind: "drawOrder", source: "@drawOrder", channel: "drawOrder", decision: "skip", reason: "Different slot layout" },
    { kind: "unknown", source: "future", channel: "unknown", decision: "skip", reason: "Not portable" },
  ];
  const authored = [
    { time: 0, offsets: [{ slot: "Z-hand", offset: 1 }] },
    { time: 0.5 },
  ];
  const { animation, report } = migrateSpineAnimation(source, target, "wave", mappings, [], policies, undefined, undefined, authored);
  assert.equal(report.blocked, false);
  assert.deepEqual(animation.drawOrder, authored);
  assert.equal(report.channels.find((item) => item.kind === "drawOrder")?.status, "explicit-skip");
  assert.ok(report.warnings.some((item) => /target-authored.*drawOrder.*2/i.test(item)));
  assert.deepEqual(source.animations.wave.drawOrder, [{ time: 0.5, offsets: [{ slot: "hand", offset: 0 }] }]);
  assert.throws(() => migrateSpineAnimation(source, target, "wave", mappings, [], policies, undefined, undefined,
    [{ time: 0, offsets: [{ slot: "missing", offset: 1 }] }]), /slot.*missing/i);
  assert.throws(() => migrateSpineAnimation(source, target, "wave", mappings, [], policies, undefined, undefined,
    [{ time: 0, offsets: [{ slot: "Z-hand", offset: 2 }] }]), /offset|range/i);
});

test("non-full crop returns a blocked report instead of truncating source keys", () => {
  const { source, target, mappings } = fixture();
  const { report } = migrateSpineAnimation(source, target, "wave", mappings, [], [], [0.2, 0.8]);
  assert.equal(report.blocked, true);
  assert.match(report.channels.find((item) => item.channel === "@range")?.reason ?? "", /crop|range/i);
});

test("an all-skipped job is blocked instead of exporting an empty success", () => {
  const { source, target } = fixture();
  const deps = readSpineSource(JSON.stringify(source)).animationDependencies.wave!;
  const policies: SpineChannelPolicy[] = deps.map((item) => ({ kind: item.kind, source: item.source, channel: item.channel,
    decision: "skip", reason: "Probe", ...(item.sourceSkin ? { sourceSkin: item.sourceSkin } : {}),
    ...(item.sourceSlot ? { sourceSlot: item.sourceSlot } : {}) }));
  const { report } = migrateSpineAnimation(source, target, "wave", [], [], policies);
  assert.equal(report.blocked, true);
  assert.match(report.channels.find((item) => item.channel === "@empty")?.reason ?? "", /no copied|empty/i);
});

test("FK is allowed only when a mapped IK timeline explicitly disables it from time zero", () => {
  const { source, target, mappings } = fixture();
  target.constraints[0]!.mix = 1;
  const policies: SpineChannelPolicy[] = [
    { kind: "slot", source: "hand", channel: "attachment", decision: "skip", reason: "Target display" },
    { kind: "drawOrder", source: "@drawOrder", channel: "drawOrder", decision: "skip", reason: "Other slot layout" },
    { kind: "event", source: "hit", channel: "event", decision: "skip", reason: "Target event omitted" },
    { kind: "unknown", source: "future", channel: "unknown", decision: "skip", reason: "Unknown" },
  ];
  const zero = migrateSpineAnimation(source, target, "wave", mappings, [], policies);
  assert.equal(zero.report.channels.find((item) => item.source === "upper" && item.channel === "rotate")?.status, "direct");
  assert.equal(zero.report.blocked, false);
  source.animations.wave.ik.armIK[0]!.mix = 0.2;
  const mixed = migrateSpineAnimation(source, target, "wave", mappings, [], policies);
  assert.equal(mixed.report.channels.find((item) => item.source === "upper" && item.channel === "rotate")?.status, "conflict");
});

test("one character mapping supports action-scoped skip decisions", () => {
  const { source, target } = fixture();
  (source.animations as Record<string, unknown>).other = structuredClone(source.animations.wave);
  const policy: SpineChannelPolicy = { kind: "bone", source: "forearm", channel: "rotate", decision: "skip",
    reason: "This gesture leaves the target forearm at setup", sourceAnimation: "wave" };
  const wave = migrateSpineAnimation(source, target, "wave", [], [], [policy]);
  const other = migrateSpineAnimation(source, target, "other", [], [], [policy]);
  assert.equal(wave.report.channels.find((item) => item.source === "forearm")?.status, "explicit-skip");
  assert.equal(other.report.channels.find((item) => item.source === "forearm")?.status, "unmapped");
  const globalSkip: SpineChannelPolicy = { kind: "bone", source: "forearm", channel: "rotate",
    decision: "skip", reason: "Global display choice" };
  const scopedCopy: SpineChannelPolicy = { ...globalSkip, sourceAnimation: "wave", decision: "copy",
    reason: "Wave uses the forearm" };
  const waveOverride = migrateSpineAnimation(source, target, "wave", [], [], [globalSkip, scopedCopy]);
  const otherGlobal = migrateSpineAnimation(source, target, "other", [], [], [globalSkip, scopedCopy]);
  assert.equal(waveOverride.report.channels.find((item) => item.source === "forearm")?.status, "unmapped");
  assert.equal(otherGlobal.report.channels.find((item) => item.source === "forearm")?.status, "explicit-skip");
});

test("a scoped skip removes a destination collision only for that action", () => {
  const { source, target } = fixture();
  source.animations.wave.bones.forearm.rotate = [{ value: 12 }];
  const mappings: SpineObjectMapping[] = [
    { kind: "bone", source: "upper", target: "Larm1", side: "left", drive: "fk-bone", channels: ["rotate"] },
    { kind: "bone", source: "forearm", target: "Larm1", side: "left", drive: "fk-bone", channels: ["rotate"] },
  ];
  const deps = readSpineSource(JSON.stringify(source)).animationDependencies.wave!;
  const skips: SpineChannelPolicy[] = deps.filter((item) => !(item.kind === "bone" && item.channel === "rotate" &&
    ["upper", "forearm"].includes(item.source))).map((item) => ({ kind: item.kind, source: item.source,
      channel: item.channel, decision: "skip", reason: "Collision probe", ...(item.sourceSkin ? { sourceSkin: item.sourceSkin } : {}),
      ...(item.sourceSlot ? { sourceSlot: item.sourceSlot } : {}) }));
  const collision = migrateSpineAnimation(source, target, "wave", mappings, [], skips);
  assert.equal(collision.report.channels.find((item) => item.source === "upper" && item.channel === "rotate")?.status, "conflict");
  const resolved = migrateSpineAnimation(source, target, "wave", mappings, [], [...skips,
    { kind: "bone", source: "forearm", channel: "rotate", decision: "skip", sourceAnimation: "wave", reason: "Choose upper" }]);
  assert.equal(resolved.report.channels.find((item) => item.source === "upper" && item.channel === "rotate")?.status, "direct");
  assert.equal(resolved.report.blocked, false);
});

test("flags copied bone keys for setup calibration when mapped local axes differ", () => {
  const { source, target, mappings } = fixture();
  (target.bones[1]! as { rotation?: number }).rotation = 120;
  const deps = readSpineSource(JSON.stringify(source)).animationDependencies.wave!;
  const policies: SpineChannelPolicy[] = deps.filter((item) => !(item.kind === "bone" && item.source === "upper" && item.channel === "rotate"))
    .map((item) => ({ kind: item.kind, source: item.source, channel: item.channel,
      decision: "skip", reason: "Isolate upper arm setup compatibility",
      ...(item.sourceSkin ? { sourceSkin: item.sourceSkin } : {}),
      ...(item.sourceSlot ? { sourceSlot: item.sourceSlot } : {}) }));
  const result = migrateSpineAnimation(source, target, "wave", mappings, [], policies);
  const upper = result.report.channels.find((item) => item.kind === "bone" && item.source === "upper" && item.channel === "rotate");
  assert.equal(upper?.status, "needs-calibration");
  assert.match(upper?.reason ?? "", /setup|axis|rotation/i);
  assert.equal(result.report.totals.needsCalibration, 1);
  assert.equal(result.report.blocked, false);
  assert.deepEqual((result.animation.bones as any).Larm1.rotate, source.animations.wave.bones.upper.rotate);
});

test("flags copied translation when mapped bone setup scale changes its local units", () => {
  const { source, target, mappings } = fixture();
  (target.bones[1]! as { scaleX?: number }).scaleX = 2;
  const deps = readSpineSource(JSON.stringify(source)).animationDependencies.wave!;
  const policies: SpineChannelPolicy[] = deps.filter((item) => !(item.kind === "bone" && item.source === "upper" && item.channel === "translate"))
    .map((item) => ({ kind: item.kind, source: item.source, channel: item.channel,
      decision: "skip", reason: "Isolate setup scale compatibility",
      ...(item.sourceSkin ? { sourceSkin: item.sourceSkin } : {}),
      ...(item.sourceSlot ? { sourceSlot: item.sourceSlot } : {}) }));
  const result = migrateSpineAnimation(source, target, "wave", mappings, [], policies);
  const moved = result.report.channels.find((item) => item.kind === "bone" && item.source === "upper" && item.channel === "translate");
  assert.equal(moved?.status, "needs-calibration");
  assert.match(moved?.reason ?? "", /scale|unit/i);
  assert.equal(result.report.blocked, false);
});

test("blocks active IK keys when its target constraint drives an unrelated chain", () => {
  const { source, target } = fixture();
  target.bones.push({ name: "leg1", parent: "root" }, { name: "leg2", parent: "leg1" });
  target.constraints[0]!.bones = ["leg1", "leg2"];
  source.animations.wave.ik.armIK[0]!.mix = 0.5;
  const deps = readSpineSource(JSON.stringify(source)).animationDependencies.wave!;
  const policies: SpineChannelPolicy[] = deps.filter((item) => item.kind !== "ik")
    .map((item) => ({ kind: item.kind, source: item.source, channel: item.channel,
      decision: "skip", reason: "Isolate active IK topology",
      ...(item.sourceSkin ? { sourceSkin: item.sourceSkin } : {}),
      ...(item.sourceSlot ? { sourceSlot: item.sourceSlot } : {}) }));
  const mapping: SpineObjectMapping[] = [{ kind: "ik", source: "armIK", target: "targetIK", side: "unknown", drive: "ik-target" }];
  const result = migrateSpineAnimation(source, target, "wave", mapping, [], policies);
  const ik = result.report.channels.find((item) => item.kind === "ik");
  assert.equal(ik?.status, "conflict");
  assert.match(ik?.reason ?? "", /chain|bone|target/i);
  assert.equal(result.report.blocked, true);
  assert.equal(result.animation.ik, undefined);
});

test("allows zero-mix IK keys to disable a different target constraint safely", () => {
  const { source, target } = fixture();
  target.bones.push({ name: "leg1", parent: "root" }, { name: "leg2", parent: "leg1" });
  target.constraints[0]!.bones = ["leg1", "leg2"];
  const deps = readSpineSource(JSON.stringify(source)).animationDependencies.wave!;
  const policies: SpineChannelPolicy[] = deps.filter((item) => item.kind !== "ik")
    .map((item) => ({ kind: item.kind, source: item.source, channel: item.channel,
      decision: "skip", reason: "Isolate zero-mix IK",
      ...(item.sourceSkin ? { sourceSkin: item.sourceSkin } : {}),
      ...(item.sourceSlot ? { sourceSlot: item.sourceSlot } : {}) }));
  const mapping: SpineObjectMapping[] = [{ kind: "ik", source: "armIK", target: "targetIK", side: "unknown", drive: "ik-target" }];
  const result = migrateSpineAnimation(source, target, "wave", mapping, [], policies);
  assert.equal(result.report.channels.find((item) => item.kind === "ik")?.status, "direct");
  assert.equal(result.report.blocked, false);
  assert.deepEqual((result.animation.ik as any).targetIK, [{ mix: 0 }]);
});

test("does not reuse an attachment mapping from another selected skin", () => {
  const { source, target, mappings } = fixture();
  source.skins.push({ name: "alt", attachments: { hand: { open: {}, fist: {} } } });
  target.skins.push({ name: "alt", attachments: { "Z-hand": { "Z/open": {}, "Z/fist": {} } } });
  const deps = readSpineSource(JSON.stringify(source)).animationDependencies.wave!;
  const policies: SpineChannelPolicy[] = deps.filter((item) => !(item.kind === "slot" && item.channel === "attachment"))
    .map((item) => ({ kind: item.kind, source: item.source, channel: item.channel,
      decision: "skip", reason: "Isolate slot attachment skin",
      ...(item.sourceSkin ? { sourceSkin: item.sourceSkin } : {}),
      ...(item.sourceSlot ? { sourceSlot: item.sourceSlot } : {}) }));
  const result = migrateSpineAnimation(source, target, "wave", mappings, [], policies, undefined,
    { sourceSkin: "alt", targetSkin: "alt" });
  const slot = result.report.channels.find((item) => item.kind === "slot" && item.channel === "attachment");
  assert.equal(slot?.status, "conflict");
  assert.match(slot?.reason ?? "", /skin|mapping/i);
  assert.equal(result.animation.slots, undefined);
  const altMappings = mappings.map((item) => item.kind === "attachment"
    ? { ...item, sourceSkin: "alt", targetSkin: "alt" } : item);
  const selected = migrateSpineAnimation(source, target, "wave", altMappings, [], policies, undefined,
    { sourceSkin: "alt", targetSkin: "alt" });
  assert.equal(selected.report.blocked, false);
  assert.equal(selected.report.channels.find((item) => item.kind === "slot" && item.channel === "attachment")?.status, "direct");
  assert.deepEqual((selected.animation.slots as any)["Z-hand"].attachment, [
    { name: "Z/open" }, { time: 0.5, name: "Z/fist" },
  ]);
});

const rhinyJson = fileURLToPath(new URL("../../../work/SPW-02/asset-audit/rhiny/rhiny.json", import.meta.url));
const rozeulJson = fileURLToPath(new URL("../../../work/SPW-02/asset-audit/rozeul/rozeul.json", import.meta.url));
const rozeulAtlas = fileURLToPath(new URL("../../../work/SPW-02/asset-audit/rozeul/rozeul.atlas", import.meta.url));
test("real rhiny left arm keys survive both native actions in the official 4.3 runtime", {
  skip: ![rhinyJson, rozeulJson, rozeulAtlas].every(existsSync),
}, () => {
  const source = JSON.parse(readFileSync(rhinyJson, "utf8"));
  const target = JSON.parse(readFileSync(rozeulJson, "utf8"));
  const mappings: SpineObjectMapping[] = [
    { kind: "bone", source: "hips11", target: "Larm1", side: "left", drive: "fk-bone" },
    { kind: "bone", source: "hips12", target: "Larm2", side: "left", drive: "fk-bone" },
    { kind: "bone", source: "hips13", target: "Lhand", side: "left", drive: "fk-bone" },
  ];
  const atlas = new TextureAtlas(readFileSync(rozeulAtlas, "utf8"));
  for (const name of ["run", "city/interact"]) {
    const dependencies = readSpineSource(JSON.stringify(source)).animationDependencies[name]!;
    const selected = new Set(["hips11", "hips12", "hips13"]);
    const policies: SpineChannelPolicy[] = dependencies.filter((item) => !(item.kind === "bone" && selected.has(item.source)))
      .map((item) => ({ kind: item.kind, source: item.source, channel: item.channel,
        reason: "Isolated real arm roundtrip probe; other channels intentionally omitted",
        decision: "skip", ...(item.sourceSkin ? { sourceSkin: item.sourceSkin } : {}),
        ...(item.sourceSlot ? { sourceSlot: item.sourceSlot } : {}) }));
    const result = migrateSpineAnimation(source, target, name, mappings, [], policies);
    assert.equal(result.report.blocked, false);
    assert.equal(result.report.totals.direct + result.report.totals.needsCalibration >= 3, true);
    assert.equal(result.report.channels.length, dependencies.length);
    assert.deepEqual((result.animation.bones as any).Larm1.rotate, source.animations[name].bones.hips11.rotate);
    const appended = appendDirectAnimation(target, result.animation, `SPW02_${name.replace("/", "_")}`);
    const skeletonData = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(appended.jsonText);
    assert.ok(skeletonData.findAnimation(appended.name));
    const poseAt = (seconds: number) => {
      const skeleton = new Skeleton(skeletonData);
      skeleton.setupPose();
      const state = new AnimationState(new AnimationStateData(skeletonData));
      state.setAnimation(0, appended.name, false);
      state.update(seconds);
      state.apply(skeleton);
      skeleton.updateWorldTransform(Physics.reset);
      const upper = skeleton.findBone("Larm1")?.appliedPose;
      const forearm = skeleton.findBone("Larm2")?.appliedPose;
      assert.ok(upper && forearm);
      return [upper.a, upper.c, forearm.a, forearm.c];
    };
    const first = poseAt(0);
    const later = poseAt(name === "run" ? 1.25 : 0.4);
    assert.ok(first.some((value, index) => Math.abs(value - later[index]!) > 1e-4), `${name} arm did not move`);
  }
});

test("real run has explicit foot IK-off keys while city/interact does not", {
  skip: ![rhinyJson, rozeulJson].every(existsSync),
}, () => {
  const source = JSON.parse(readFileSync(rhinyJson, "utf8"));
  const target = JSON.parse(readFileSync(rozeulJson, "utf8"));
  const mappings: SpineObjectMapping[] = [
    { kind: "bone", source: "hips42", target: "Rleg1", side: "right", drive: "fk-bone" },
    { kind: "ik", source: "rightfoot", target: "Rleg_ik", side: "right", drive: "ik-target" },
  ];
  for (const action of ["run", "city/interact"]) {
    const dependencies = readSpineSource(JSON.stringify(source)).animationDependencies[action]!;
    const policies: SpineChannelPolicy[] = dependencies.filter((item) =>
      !(item.kind === "bone" && item.source === "hips42") && !(item.kind === "ik" && item.source === "rightfoot"))
      .map((item) => ({ kind: item.kind, source: item.source, channel: item.channel, decision: "skip", reason: "Leg gate probe",
        ...(item.sourceSkin ? { sourceSkin: item.sourceSkin } : {}),
        ...(item.sourceSlot ? { sourceSlot: item.sourceSlot } : {}) }));
    const { report } = migrateSpineAnimation(source, target, action, mappings, [], policies);
    const legStatus = report.channels.find((item) => item.kind === "bone" && item.source === "hips42" && item.channel === "rotate")?.status;
    assert.equal(action === "run" ? ["direct", "needs-calibration"].includes(legStatus ?? "") : legStatus === "conflict", true);
    assert.equal(report.blocked, action !== "run");
  }
});
