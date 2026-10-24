import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  AnimationState,
  AnimationStateData,
  AtlasAttachmentLoader,
  Physics,
  Skeleton,
  SkeletonJson,
  TextureAtlas,
} from "@esotericsoftware/spine-webgl";
import { appendAnimation } from "../src/output/spine43-animation.ts";
import { readSpineTarget } from "../src/target/spine-target.ts";

const packed = fileURLToPath(new URL("../../../work/SPW-01/inputs/rozeul/packed/", import.meta.url));
const jsonFile = join(packed, "rozeul.json");
const atlasFile = join(packed, "rozeul.atlas");

test("official 4.3 runtime applies a newly appended target animation", {
  skip: !existsSync(jsonFile) || !existsSync(atlasFile),
}, () => {
  const original = readFileSync(jsonFile, "utf8");
  const { document, summary } = readSpineTarget(original);
  const name = "SPW_runtime_roundtrip_probe";
  const generated = appendAnimation(document, {
    name,
    durationSeconds: 0.5,
    frames: [
      { seconds: 0, keys: [{ target: "LlegIK_hips", property: "x", value: 0 }], diagnostics: [] },
      { seconds: 0.5, keys: [{ target: "LlegIK_hips", property: "x", value: 20 }], diagnostics: [] },
    ],
  });
  const atlas = new TextureAtlas(readFileSync(atlasFile, "utf8"));
  const skeletonData = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(generated.jsonText);
  assert.equal(skeletonData.animations.length, summary.animations.length + 1);
  assert.equal(skeletonData.findAnimation(name)?.duration, 0.5);

  const worldXAt = (seconds: number): number => {
    const skeleton = new Skeleton(skeletonData);
    skeleton.setupPose();
    const state = new AnimationState(new AnimationStateData(skeletonData));
    state.setAnimation(0, name, false);
    state.update(seconds);
    state.apply(skeleton);
    skeleton.updateWorldTransform(Physics.reset);
    const bone = skeleton.findBone("LlegIK_hips");
    assert.ok(bone);
    return bone.appliedPose.worldX;
  };
  const first = worldXAt(0);
  const last = worldXAt(0.5);
  assert.ok(Number.isFinite(first) && Number.isFinite(last));
  assert.ok(Math.abs(last - first) > 10, `IK target did not move: ${first} → ${last}`);
});
