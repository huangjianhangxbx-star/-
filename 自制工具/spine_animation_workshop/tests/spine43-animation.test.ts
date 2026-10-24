import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { GeneratedClip } from "../src/core/contracts.ts";
import { appendAnimation } from "../src/output/spine43-animation.ts";

const realJsonPath = fileURLToPath(
  new URL("../../../work/SPW-01/inputs/rozeul/packed/rozeul.json", import.meta.url),
);

const document = {
  skeleton: { spine: "4.3.26", custom: "keep" },
  bones: [{ name: "root" }, { name: "centroid", parent: "root" }, { name: "body", parent: "centroid" }],
  constraints: [{ type: "ik", name: "Rarm_ik", bones: ["body"], target: "centroid" }],
  skins: [{ name: "default", attachments: { body: { region: { vertices: [1, 2, 3] } } } }],
  animations: { walk: { bones: { body: { rotate: [{ value: 10 }] } } }, walk_2: {} },
  futureField: { nested: [1, 2] },
};

const clip: GeneratedClip = {
  name: "new_walk",
  durationSeconds: 1,
  frames: [
    { seconds: 0, keys: [
      { target: "centroid", property: "x", value: 0 },
      { target: "centroid", property: "y", value: 5 },
      { target: "body", property: "rotation", value: 0 },
      { target: "Rarm_ik", property: "ikMix", value: 0 },
    ], diagnostics: [] },
    { seconds: 1, keys: [
      { target: "centroid", property: "x", value: 20 },
      { target: "centroid", property: "y", value: 9 },
      { target: "body", property: "rotation", value: 25 },
      { target: "Rarm_ik", property: "ikMix", value: 1 },
    ], diagnostics: [] },
  ],
};

test("appends Spine 4.3 timelines and leaves the input document intact", () => {
  const original = structuredClone(document);
  const result = appendAnimation(document, clip);
  const output = JSON.parse(result.jsonText);
  assert.equal(result.name, "new_walk");
  assert.deepEqual(document, original);
  assert.deepEqual(output.skeleton, original.skeleton);
  assert.deepEqual(output.bones, original.bones);
  assert.deepEqual(output.constraints, original.constraints);
  assert.deepEqual(output.skins, original.skins);
  assert.deepEqual(output.futureField, original.futureField);
  assert.deepEqual(output.animations.walk, original.animations.walk);
  assert.deepEqual(output.animations.walk_2, original.animations.walk_2);
  assert.deepEqual(output.animations.new_walk.bones.centroid.translate, [
    { x: 0, y: 5 }, { time: 1, x: 20, y: 9 },
  ]);
  assert.deepEqual(output.animations.new_walk.bones.body.rotate, [
    { value: 0 }, { time: 1, value: 25 },
  ]);
  assert.deepEqual(output.animations.new_walk.ik.Rarm_ik, [
    { mix: 0 }, { time: 1, mix: 1 },
  ]);
});

test("allocates a new numbered name instead of overwriting an animation", () => {
  const result = appendAnimation(document, { ...clip, name: "walk" });
  const output = JSON.parse(result.jsonText);
  assert.equal(result.name, "walk_3");
  assert.equal(Object.keys(output.animations).length, 3);
  assert.deepEqual(output.animations.walk, document.animations.walk);
});

test("writes scale and sparse translation values in Spine 4.3 timeline fields", () => {
  const result = appendAnimation(document, {
    name: "scale_walk", durationSeconds: 1,
    frames: [
      { seconds: 0, keys: [
        { target: "body", property: "scaleX", value: -1 },
        { target: "centroid", property: "x", value: 4 },
      ], diagnostics: [] },
      { seconds: 1, keys: [
        { target: "body", property: "scaleY", value: 2 },
        { target: "centroid", property: "y", value: 8 },
      ], diagnostics: [] },
    ],
  });
  const animation = JSON.parse(result.jsonText).animations.scale_walk;
  assert.deepEqual(animation.bones.body.scale, [{ x: -1, y: 1 }, { time: 1, x: -1, y: 2 }]);
  assert.deepEqual(animation.bones.centroid.translate, [{ x: 4, y: 0 }, { time: 1, x: 4, y: 8 }]);
});

test("rejects invalid time order, nonfinite keys, and unknown targets", () => {
  assert.throws(() => appendAnimation(document, { ...clip, frames: [...clip.frames].reverse() }), /time|seconds|order/i);
  assert.throws(() => appendAnimation(document, { ...clip, frames: [
    { seconds: 0, keys: [{ target: "body", property: "rotation", value: Number.NaN }], diagnostics: [] },
  ] }), /finite|value/i);
  assert.throws(() => appendAnimation(document, { ...clip, frames: [
    { seconds: 0, keys: [{ target: "missing", property: "rotation", value: 1 }], diagnostics: [] },
  ] }), /missing/);
  assert.throws(() => appendAnimation(document, { ...clip, frames: [
    { seconds: 0, keys: [{ target: "body", property: "ikMix", value: 0.5 }], diagnostics: [] },
  ] }), /body|IK/);
});

test("preserves all existing real character content while appending", {
  skip: !existsSync(realJsonPath),
}, () => {
  const real = JSON.parse(readFileSync(realJsonPath, "utf8"));
  const result = appendAnimation(real, {
    ...clip,
    frames: clip.frames.map((frame) => ({ ...frame, keys: frame.keys.filter((key) => key.target !== "Rarm_ik") })),
  });
  const output = JSON.parse(result.jsonText);
  assert.deepEqual(output.skeleton, real.skeleton);
  assert.deepEqual(output.bones, real.bones);
  assert.deepEqual(output.slots, real.slots);
  assert.deepEqual(output.constraints, real.constraints);
  assert.deepEqual(output.skins, real.skins);
  assert.deepEqual(output.events, real.events);
  for (const [name, animation] of Object.entries(real.animations)) {
    assert.deepEqual(output.animations[name], animation);
  }
  assert.equal(Object.keys(output.animations).length, Object.keys(real.animations).length + 1);
});
