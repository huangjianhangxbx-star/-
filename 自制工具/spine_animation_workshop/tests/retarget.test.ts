import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createTransfer } from "../src/transfer/retarget.ts";
import { readSpineTarget } from "../src/target/spine-target.ts";
import { bone, config, motion, target, type Point3 } from "./transfer-fixtures.ts";

const realTargetJson = new URL("../../../work/SPW-01/inputs/rozeul/packed/rozeul.json", import.meta.url);
const realSourceGlb = new URL("../../../work/SPW-01/inputs/CesiumMan.glb", import.meta.url);

function key(frame: ReturnType<ReturnType<typeof createTransfer>["poseAt"]>, name: string, property: string): number {
  const found = frame.keys.find((entry) => entry.target === name && entry.property === property);
  assert.ok(found, `missing ${name}.${property}`);
  return found.value;
}

test("orthographic yaw, small pitch, and mirror alter IK target projection independently", () => {
  const nodes = [
    { path: "root", parentPath: null, bind: [0, 0, 0] as Point3 },
    { path: "root/hand", parentPath: "root", bind: [0, 0, 0] as Point3 },
  ];
  const source = motion(nodes, (_seconds, path) => (path === "root/hand" ? [1, 0, 1] : [0, 0, 0]));
  const rig = target([bone("root", null), bone("handIK", "root")], [
    { kind: "ik", name: "armIK", bones: ["upper", "lower"], target: "handIK" },
  ]);
  const mappings = [{ sourcePath: "root/hand", target: "handIK", mode: "ik-target" as const, side: "right" as const }];
  const base = config({ mappings, anchors: { sourceFootPath: "root", sourceRootPath: "root", targetFootBone: "root", scale: 10, offsetX: 0, offsetY: 0 } });
  const frontal = createTransfer(source, rig, base).poseAt(0);
  assert.equal(key(frontal, "handIK", "x"), 10);
  assert.equal(key(frontal, "handIK", "y"), 0);
  const turned = createTransfer(source, rig, config({ ...base, view: { yawDegrees: 90, pitchDegrees: 0, mirror: false } })).poseAt(0);
  assert.ok(Math.abs(key(turned, "handIK", "x") + 10) < 1e-8);
  const pitched = createTransfer(source, rig, config({ ...base, view: { yawDegrees: 0, pitchDegrees: 10, mirror: false } })).poseAt(0);
  assert.ok(key(pitched, "handIK", "y") < 0);
  const mirrored = createTransfer(source, rig, config({ ...base, view: { yawDegrees: 0, pitchDegrees: 0, mirror: true } })).poseAt(0);
  assert.equal(key(mirrored, "handIK", "x"), -10);
});

test("IK controller position is converted through the setup parent, not written as world x/y", () => {
  const source = motion(
    [{ path: "root", parentPath: null, bind: [0, 0, 0] }, { path: "root/foot", parentPath: "root", bind: [0, 0, 0] }],
    (_seconds, path) => (path === "root/foot" ? [1, 0, 0] : [0, 0, 0]),
  );
  const rig = target([bone("root", null, { x: 10, y: 20, rotation: 90 }), bone("footIK", "root", { x: 2 })], [
    { kind: "ik", name: "legIK", bones: ["leg1", "leg2"], target: "footIK" },
  ]);
  const frame = createTransfer(source, rig, config({
    mappings: [{ sourcePath: "root/foot", target: "footIK", mode: "ik-target", side: "left" }],
  })).poseAt(0);
  assert.ok(Math.abs(key(frame, "footIK", "x")) < 1e-8);
  assert.ok(Math.abs(key(frame, "footIK", "y") + 1) < 1e-8);
});

test("FK child does not double-rotate when parent also rotates", () => {
  const nodes = [
    { path: "root", parentPath: null, bind: [0, 0, 0] as Point3 },
    { path: "root/upper", parentPath: "root", bind: [0, 0, 0] as Point3 },
    { path: "root/upper/lower", parentPath: "root/upper", bind: [1, 0, 0] as Point3 },
    { path: "root/upper/lower/hand", parentPath: "root/upper/lower", bind: [2, 0, 0] as Point3 },
  ];
  const source = motion(nodes, (_seconds, path) => {
    if (path.endsWith("hand")) return [0, 2, 0];
    if (path.endsWith("lower")) return [0, 1, 0];
    return [0, 0, 0];
  });
  const rig = target([bone("root", null), bone("upper", "root"), bone("lower", "upper", { x: 1 })]);
  const frame = createTransfer(source, rig, config({ mappings: [
    { sourcePath: "root/upper", sourceEndPath: "root/upper/lower", target: "upper", mode: "fk-bone", side: "right" },
    { sourcePath: "root/upper/lower", sourceEndPath: "root/upper/lower/hand", target: "lower", mode: "fk-bone", side: "right" },
  ] })).poseAt(0);
  assert.ok(Math.abs(key(frame, "upper", "rotation") - 90) < 1e-8);
  assert.ok(Math.abs(key(frame, "lower", "rotation")) < 1e-8);
});

test("an IK-controlled leg cannot be mapped as FK, while mapping its target yields no leg rotations", () => {
  const source = motion(
    [{ path: "root", parentPath: null, bind: [0, 0, 0] }, { path: "root/foot", parentPath: "root", bind: [0, 0, 0] }],
    (_seconds, path) => (path === "root/foot" ? [1, 0, 0] : [0, 0, 0]),
  );
  const rig = target([bone("root", null), bone("leg1", "root"), bone("leg2", "leg1"), bone("legIK", "root")], [
    { kind: "ik", name: "leg", bones: ["leg1", "leg2"], target: "legIK" },
  ]);
  assert.throws(() => createTransfer(source, rig, config({ mappings: [
    { sourcePath: "root/foot", target: "leg1", mode: "fk-bone", side: "left" },
  ] })), /IK|约束/i);
  const frame = createTransfer(source, rig, config({ mappings: [
    { sourcePath: "root/foot", target: "legIK", mode: "ik-target", side: "left" },
  ] })).poseAt(0);
  assert.ok(frame.keys.length > 0);
  assert.ok(frame.keys.every((entry) => entry.target === "legIK"));
});

test("ground travel is removed while source vertical rise remains", () => {
  const source = motion(
    [{ path: "root", parentPath: null, bind: [0, 0, 0] }, { path: "root/body", parentPath: "root", bind: [0, 0, 0] }],
    (_seconds, path) => (path === "root" || path === "root/body" ? [5, 2, 0] : [0, 0, 0]),
  );
  const rig = target([bone("root", null), bone("bodyControl", "root")]);
  const frame = createTransfer(source, rig, config({ mappings: [
    { sourcePath: "root/body", target: "bodyControl", mode: "transform-control", side: "center" },
  ] })).poseAt(0);
  assert.ok(Math.abs(key(frame, "bodyControl", "x")) < 1e-8);
  assert.ok(Math.abs(key(frame, "bodyControl", "y") - 2) < 1e-8);
});

test("near-zero projected segment uses a finite fallback and reports the affected target", () => {
  const source = motion(
    [{ path: "root", parentPath: null, bind: [0, 0, 0] }, { path: "root/arm", parentPath: "root", bind: [0, 0, 0] }, { path: "root/arm/hand", parentPath: "root/arm", bind: [1, 0, 0] }],
    (_seconds, path) => (path === "root/arm/hand" ? [0, 0, 1] : [0, 0, 0]),
  );
  const frame = createTransfer(source, target([bone("root", null), bone("arm", "root")]), config({ mappings: [
    { sourcePath: "root/arm", sourceEndPath: "root/arm/hand", target: "arm", mode: "fk-bone", side: "right" },
  ] })).poseAt(0);
  assert.ok(Number.isFinite(key(frame, "arm", "rotation")));
  assert.ok(frame.diagnostics.some((entry) => entry.target === "arm" && /degenerate|投影/i.test(entry.code + entry.message)));
});

test("unrelated non-normal inherit bones in real rozeul do not block a normal IK target chain", { skip: !existsSync(realTargetJson) }, () => {
  const json = readFileSync(realTargetJson, "utf8");
  const rig = readSpineTarget(json).summary;
  assert.ok(rig.bones.some((entry) => entry.transform && entry.transform !== "normal"));
  const source = motion(
    [{ path: "root", parentPath: null, bind: [0, 0, 0] }, { path: "root/foot", parentPath: "root", bind: [0, 0, 0] }],
    (_seconds, path) => (path === "root/foot" ? [0.1, 0, 0] : [0, 0, 0]),
  );
  const frame = createTransfer(source, rig, config({
    anchors: { sourceFootPath: "root/foot", sourceRootPath: "root", targetFootBone: "LlegIK_hips", scale: 1, offsetX: 0, offsetY: 0 },
    mappings: [{ sourcePath: "root/foot", target: "LlegIK_hips", mode: "ik-target", side: "left" }],
  })).poseAt(0);
  assert.ok(frame.keys.some((entry) => entry.target === "LlegIK_hips" && entry.property === "x"));
});

test("real CesiumMan drives rozeul body and both leg IK targets without keying controlled leg bones", { skip: !existsSync(realTargetJson) || !existsSync(realSourceGlb) }, async () => {
  const { openGlb } = await import("../src/source/glb-motion.ts");
  const { generateClip } = await import("../src/transfer/sample-clip.ts");
  const bytes = readFileSync(realSourceGlb);
  const source = await openGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const rig = readSpineTarget(readFileSync(realTargetJson, "utf8")).summary;
  const path = (name: string): string => {
    const joint = source.joints.find((entry) => entry.name === name);
    assert.ok(joint, `missing source joint ${name}`);
    return joint.path;
  };
  const clip = generateClip(source, rig, config({
    source: { file: "CesiumMan.glb", clipId: source.clips[0]!.id, frontAxis: "+Z", upAxis: "+Y", rangeSeconds: [0, 2], referenceSeconds: 0 },
    anchors: { sourceFootPath: path("leg_joint_L_5"), sourceRootPath: path("Skeleton_torso_joint_1"), targetFootBone: "LlegIK_hips", scale: 500, offsetX: 0, offsetY: 0 },
    mappings: [
      { sourcePath: path("Skeleton_torso_joint_1"), sourceEndPath: path("Skeleton_torso_joint_2"), target: "body", mode: "fk-bone", side: "center" },
      { sourcePath: path("Skeleton_torso_joint_2"), sourceEndPath: path("torso_joint_3"), target: "chest", mode: "fk-bone", side: "center" },
      { sourcePath: path("leg_joint_L_5"), target: "LlegIK_hips", mode: "ik-target", side: "left" },
      { sourcePath: path("leg_joint_R_5"), target: "RlegIK_hips", mode: "ik-target", side: "right" },
    ],
    sampleHz: 10,
  }));
  assert.equal(clip.durationSeconds, 2);
  assert.equal(clip.frames[0]?.seconds, 0);
  assert.equal(clip.frames.at(-1)?.seconds, 2);
  assert.ok(clip.frames.every((frame) => frame.keys.length === 6));
  assert.ok(clip.frames.every((frame) => frame.keys.every((entry) => Number.isFinite(entry.value))));
  assert.ok(clip.frames.every((frame) => frame.keys.every((entry) => !["Lleg1", "Lleg2", "Rleg1", "Rleg2"].includes(entry.target))));
});
