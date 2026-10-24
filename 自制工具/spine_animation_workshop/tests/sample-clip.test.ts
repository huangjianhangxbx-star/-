import test from "node:test";
import assert from "node:assert/strict";
import { generateClip } from "../src/transfer/sample-clip.ts";
import { bone, config, motion, target } from "./transfer-fixtures.ts";

test("nonzero source range is sampled at exact endpoints on a new zero-based timeline", () => {
  const source = motion(
    [{ path: "root", parentPath: null, bind: [0, 0, 0] }, { path: "root/foot", parentPath: "root", bind: [0, 0, 0] }],
    (seconds, path) => (path === "root/foot" ? [seconds, 0, 0] : [0, 0, 0]),
    2,
  );
  const clip = generateClip(source, target([bone("root", null), bone("footIK", "root")], [
    { kind: "ik", name: "leg", bones: ["leg1", "leg2"], target: "footIK" },
  ]), config({
    source: { file: "source.glb", clipId: "clip", frontAxis: "+Z", upAxis: "+Y", rangeSeconds: [0.25, 1.75] },
    mappings: [{ sourcePath: "root/foot", target: "footIK", mode: "ik-target", side: "left" }],
    sampleHz: 2,
  }));
  assert.equal(clip.durationSeconds, 1.5);
  assert.deepEqual(clip.frames.map((frame) => frame.seconds), [0, 0.5, 1, 1.5]);
  assert.equal(clip.frames[0]?.keys.find((entry) => entry.property === "x")?.value, 0.25);
  assert.equal(clip.frames.at(-1)?.keys.find((entry) => entry.property === "x")?.value, 1.75);
});

test("sampled rotation unwraps through 180 degrees without a full-spin jump", () => {
  const source = motion(
    [{ path: "root", parentPath: null, bind: [0, 0, 0] }, { path: "root/arm", parentPath: "root", bind: [0, 0, 0] }, { path: "root/arm/hand", parentPath: "root/arm", bind: [1, 0, 0] }],
    (seconds, path) => {
      if (path !== "root/arm/hand") return [0, 0, 0];
      const radians = (170 + 20 * seconds) * Math.PI / 180;
      return [Math.cos(radians), Math.sin(radians), 0];
    },
  );
  const clip = generateClip(source, target([bone("root", null), bone("arm", "root")]), config({
    mappings: [{ sourcePath: "root/arm", sourceEndPath: "root/arm/hand", target: "arm", mode: "fk-bone", side: "right" }],
    sampleHz: 2,
  }));
  const angles = clip.frames.map((frame) => frame.keys.find((entry) => entry.target === "arm" && entry.property === "rotation")?.value);
  assert.equal(angles.length, 3);
  assert.ok(Math.abs((angles[0] ?? 0) - 170) < 1e-8);
  assert.ok(Math.abs((angles[1] ?? 0) - 180) < 1e-8);
  assert.ok(Math.abs((angles[2] ?? 0) - 190) < 1e-8);
});

test("a degenerate middle frame retains the prior sampled direction and a diagnostic", () => {
  const source = motion(
    [{ path: "root", parentPath: null, bind: [0, 0, 0] }, { path: "root/arm", parentPath: "root", bind: [0, 0, 0] }, { path: "root/arm/hand", parentPath: "root/arm", bind: [1, 0, 0] }],
    (seconds, path) => {
      if (path !== "root/arm/hand") return [0, 0, 0];
      if (seconds === 0.5) return [0, 0, 1];
      return [0, 1, 0];
    },
  );
  const clip = generateClip(source, target([bone("root", null), bone("arm", "root")]), config({
    mappings: [{ sourcePath: "root/arm", sourceEndPath: "root/arm/hand", target: "arm", mode: "fk-bone", side: "right" }],
    sampleHz: 2,
  }));
  const angles = clip.frames.map((frame) => frame.keys.find((entry) => entry.target === "arm" && entry.property === "rotation")?.value);
  assert.deepEqual(angles, [90, 90, 90]);
  assert.ok(clip.frames[1]?.diagnostics.some((entry) => entry.target === "arm" && /degenerate|投影/i.test(entry.code + entry.message)));
});

test("sampling rejects rates below 1 Hz, above 240 Hz, and non-finite values", () => {
  const source = motion([{ path: "root", parentPath: null, bind: [0, 0, 0] }], () => [0, 0, 0]);
  const rig = target([bone("root", null), bone("footIK", "root")], [
    { kind: "ik", name: "leg", bones: ["leg1", "leg2"], target: "footIK" },
  ]);
  for (const sampleHz of [0.5, 241, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => generateClip(source, rig, config({ sampleHz, mappings: [{ sourcePath: "root", target: "footIK", mode: "ik-target", side: "center" }] })),
      /采样率.*1.*240/,
      `sampleHz=${sampleHz}`,
    );
  }
});

test("sampling rejects non-finite, negative, reversed, and zero-length ranges", () => {
  const source = motion([{ path: "root", parentPath: null, bind: [0, 0, 0] }], () => [0, 0, 0]);
  const rig = target([bone("root", null)]);
  for (const rangeSeconds of [[Number.NaN, 1], [0, Number.POSITIVE_INFINITY], [-1, 1], [0.8, 0.2], [0.5, 0.5]] as const) {
    assert.throws(
      () => generateClip(source, rig, config({ source: { file: "source.glb", clipId: "clip", frontAxis: "+Z", upAxis: "+Y", rangeSeconds } })),
      /时间范围.*有限.*起点.*终点/,
      `rangeSeconds=${rangeSeconds}`,
    );
  }
});

test("sampling rejects a clip that would exceed 20,000 generated frames", () => {
  const source = motion([{ path: "root", parentPath: null, bind: [0, 0, 0] }], () => [0, 0, 0], 90);
  const rig = target([bone("root", null), bone("footIK", "root")], [
    { kind: "ik", name: "leg", bones: ["leg1", "leg2"], target: "footIK" },
  ]);
  assert.throws(
    () => generateClip(source, rig, config({
      source: { file: "source.glb", clipId: "clip", frontAxis: "+Z", upAxis: "+Y", rangeSeconds: [0, 90] },
      sampleHz: 240,
      mappings: [{ sourcePath: "root", target: "footIK", mode: "ik-target", side: "center" }],
    })),
    /采样帧数.*20,000/,
  );
});
