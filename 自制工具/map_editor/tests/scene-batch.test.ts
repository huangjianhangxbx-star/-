import { test } from "node:test";
import assert from "node:assert/strict";
import { createAsset, createScene } from "../core/workshop-documents.ts";
import { SceneSession } from "../core/scene-session.ts";
function fixture() {
  const a = createAsset("a"),
    s = createScene("s");
  s.assets.push(
    { kind: "voxel", assetId: "a", source: "assets/a.xhmodule.json" },
    { kind: "texture", assetId: "png", revision: 0, image: "textures/png.png" },
  );
  s.instances.push(
    {
      instanceId: "one",
      assetId: "a",
      positionM: [0, 0, 0],
      rotationDeg: 0,
      groupId: "base",
    },
    {
      instanceId: "two",
      assetId: "a",
      positionM: [1, 0, 1],
      rotationDeg: 90,
      groupId: "base",
    },
  );
  s.decals.push({
    decalId: "art",
    assetId: "png",
    positionM: [0, 0, 0],
    rotationDeg: 0,
    widthM: 2,
    heightM: 3,
  });
  return {
    a,
    session: new SceneSession(
      s,
      new Map([["a", { kind: "voxel", document: a }]]),
    ),
  };
}
test("mixed multi-copy and delete form one command and retain registrations, source identities and decal size", () => {
  const { session: s } = fixture();
  assert.equal(typeof s.duplicateMany, "function");
  s.duplicateMany(["one", "art"], ["copy", "art-copy"]);
  assert.equal(s.snapshot().instances.length, 3);
  assert.equal(s.snapshot().decals.at(-1).heightM, 3);
  s.undo();
  assert.equal(s.snapshot().instances.length, 2);
  s.redo();
  s.removeMany(["copy", "art-copy"]);
  s.undo();
  assert.equal(s.snapshot().decals.length, 2);
  assert.equal(s.snapshot().assets.length, 2);
});
test("multi transforms and group assignment validate atomically and undo in one step", () => {
  const { session: s } = fixture();
  assert.equal(typeof s.translateMany, "function");
  s.translateMany(["one", "two", "art"], [0.5, -0.25, 0.75]);
  assert.deepEqual(s.snapshot().instances[1].positionM, [1.5, -0.25, 1.75]);
  s.undo();
  assert.deepEqual(s.snapshot().instances[1].positionM, [1, 0, 1]);
  const before = s.snapshot();
  assert.throws(() => s.translateMany(["one", "two"], [0.1, 0, 0]));
  assert.deepEqual(s.snapshot(), before);
  assert.throws(() => s.removeMany(["one", "missing"]));
  assert.deepEqual(s.snapshot(), before);
  s.setGroup(["one", "two"], "platform");
  assert.ok(s.snapshot().instances.every((p) => p.groupId === "platform"));
  s.undo();
  assert.ok(s.snapshot().instances.every((p) => p.groupId === "base"));
  assert.throws(() => s.setGroup(["one", "art"], "platform"));
});
test("multi rotation snaps an asymmetric legacy Root phase without modifying source", () => {
  const { a, session: s } = fixture();
  a.anchorM = [0.125, 0, 0.125];
  a.rootMode = "legacy";
  s.setAssets(new Map([["a", { kind: "voxel", document: a }]]));
  s.transform("one", [0.125, 0, 0.125], 0);
  assert.equal(typeof s.rotateMany, "function");
  s.rotateMany(["one", "art"]);
  assert.deepEqual(s.snapshot().instances[0].positionM, [0.25, 0.125, 0.125]);
  assert.equal(s.snapshot().instances[0].rotationDeg, 90);
  assert.deepEqual(a.anchorM, [0.125, 0, 0.125]);
  s.undo();
  assert.deepEqual(s.snapshot().instances[0].positionM, [0.125, 0, 0.125]);
});
