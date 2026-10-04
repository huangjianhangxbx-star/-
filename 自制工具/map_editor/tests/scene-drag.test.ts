import { test } from "node:test";
import assert from "node:assert/strict";
let api: any = {};
try {
  api = await import("../core/scene-drag.ts");
} catch (e) {
  if (
    e.code !== "ERR_MODULE_NOT_FOUND" ||
    !e.url.endsWith("/core/scene-drag.ts")
  )
    throw e;
}
test("drag snapping follows rotated legacy Root phase rather than rounding instance origin", () => {
  assert.equal(typeof api.snapInstancePosition, "function");
  assert.deepEqual(
    api.snapInstancePosition([0.2, 0.45, -0.22], [0.125, -0.125, 0.125], 0),
    [0.125, 0.375, -0.125],
  );
  assert.deepEqual(
    api.snapInstancePosition([0.2, 0.45, -0.22], [0.125, -0.125, 0.125], 90),
    [0.125, 0.375, -0.125],
  );
  assert.deepEqual(
    api.snapInstancePosition([-0.45, 0.3, 0.77], [0.25, 0.5, -0.25], 270),
    [-0.5, 0.25, 0.75],
  );
  assert.throws(() => api.snapInstancePosition([Infinity, 0, 0], [0, 0, 0], 0));
});
