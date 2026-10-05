import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ScreenSelectionQuery } from "../desktop/selection-query.ts";
const cells = new Map(
  ["-1,0,0", "-1,0,2", "-1,0,4"].map((k) => {
    const [x, y, z] = k.split(",").map(Number);
    return [k, { x, y, z, color: 0 }];
  }),
);
function camera() {
  const c = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  c.position.set(-0.125, 5, -0.125);
  c.up.set(0, 0, -1);
  c.lookAt(-0.125, 0, -0.125);
  c.updateMatrixWorld();
  return c;
}
test("screen centers and solid depth ignore air gaps; reverse rectangle matches", async () => {
  const q = new ScreenSelectionQuery(camera(), cells, null);
  const rect = { x0: -0.1, y0: -0.1, x1: 0.1, y1: 0.1 };
  assert.deepEqual(
    (await q.select(rect, 1)).map((c) => c.z),
    [4],
  );
  assert.deepEqual(
    (await q.select(rect, 2)).map((c) => c.z),
    [2, 4],
  );
  assert.equal((await q.select(rect, Infinity)).length, 3);
  assert.equal(
    (await q.select({ x0: 0.1, y0: 0.1, x1: -0.1, y1: -0.1 }, 2)).length,
    2,
  );
  assert.equal(
    (await q.select({ x0: 0.01, y0: -0.1, x1: 0.1, y1: 0.1 }, Infinity)).length,
    0,
  );
});
test("section removes hidden candidates and occluders", async () => {
  const q = new ScreenSelectionQuery(camera(), cells, 3);
  assert.deepEqual(
    (await q.select({ x0: -1, y0: -1, x1: 1, y1: 1 }, 1)).map((c) => c.z),
    [2],
  );
});
test("aborted query never delivers partial selection", async () => {
  const q = new ScreenSelectionQuery(camera(), cells, null);
  const a = new AbortController();
  a.abort();
  await assert.rejects(
    q.select({ x0: -1, y0: -1, x1: 1, y1: 1 }, 1, a.signal),
    /cancel/,
  );
});
test("diagonal depth excludes merely grazed neighboring corners", async () => {
  const c = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.01, 100);
  c.position.set(5, 5, -5);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  const values = [
      { x: 0, y: 0, z: 0, color: 0 },
      { x: 1, y: 1, z: 1, color: 0 },
      { x: 1, y: 0, z: 0, color: 0 },
    ],
    map = new Map(values.map((v) => [`${v.x},${v.y},${v.z}`, v]));
  const q = new ScreenSelectionQuery(c, map, null),
    all = { x0: -1, y0: -1, x1: 1, y1: 1 };
  const one = await q.select(all, 1);
  assert.equal(
    one.some((v) => v.x === 0),
    false,
  );
  assert.equal(one.length, 2);
  assert.equal((await q.select(all, 2)).length, 3);
});
test("side view counts occupied layers along X rather than world Z", async () => {
  const c = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.01, 100);
  c.position.set(5, 0.125, -0.125);
  c.lookAt(0, 0.125, -0.125);
  c.updateMatrixWorld();
  const values = [-2, 0, 2].map((x) => ({ x, y: 0, z: 0, color: 0 }));
  const q = new ScreenSelectionQuery(
    c,
    new Map(values.map((v) => [`${v.x},0,0`, v])),
    null,
  );
  assert.deepEqual(
    (await q.select({ x0: -1, y0: -1, x1: 1, y1: 1 }, 2)).map((v) => v.x),
    [0, 2],
  );
});
test("point picking uses the clipped real voxel map", () => {
  const q = new ScreenSelectionQuery(camera(), cells, 3);
  assert.equal(q.hit([-0.5, 0.5, 10], [0, 0, -1])?.cell.z, 2);
});
