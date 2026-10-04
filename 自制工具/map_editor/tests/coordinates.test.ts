import { test } from "node:test";
import assert from "node:assert/strict";
import { plannedModule, fn } from "./workshop-test-support.ts";
const math = await plannedModule("coordinates");
test("source axes retain negative Y in Three and positive Y in Unity", () => {
  assert.deepEqual(fn(math, "sourceToThree")([1, 2, 3]), [1, 3, -2]);
  assert.deepEqual(fn(math, "sourceToUnity")([1, 2, 3]), [1, 3, 2]);
});
test("four source rotations transform an asymmetric point around its Root exactly", () => {
  const transform = fn(math, "transformPoint");
  for (const [angle, want] of [
    [0, [2.25, -0.5, 4.5]],
    [90, [1.5, -0.75, 4.5]],
    [180, [1.75, -1.5, 4.5]],
    [270, [2.5, -1.25, 4.5]],
    [-90, [2.5, -1.25, 4.5]],
    [450, [1.5, -0.75, 4.5]],
  ])
    assert.deepEqual(
      transform([0.5, 0.75, 0.75], [0.25, 0.25, 0.25], [2, -1, 4], angle),
      want,
    );
});
test("voxel alignment checks geometry phase instead of rounding half-grid Root", () => {
  const aligned = fn(math, "isVoxelAligned");
  assert.equal(aligned([0.125, 0, 0], [0.125, 0, 0], 0), true);
  assert.equal(aligned([0.125, 0, 0], [0, 0.125, 0], 90), true);
  assert.equal(aligned([0.125, 0, 0], [0, 0, 0], 0), false);
  assert.equal(aligned([0, 0, 0], [-0.5000005, 0, 0], 0), true);
  assert.equal(aligned([0, 0, 0], [-0.500002, 0, 0], 0), false);
});
test("transform functions reject malformed tuples and unsupported rotation", () => {
  const transform = fn(math, "transformPoint");
  for (const point of [
    [NaN, 0, 0],
    [0, 0],
    [0, 0, 0, 0],
  ])
    assert.throws(() => transform(point, [0, 0, 0], [0, 0, 0], 0));
  for (const angle of [45, Infinity, 90.5, 360090])
    assert.throws(() => transform([0, 0, 0], [0, 0, 0], [0, 0, 0], angle));
});
