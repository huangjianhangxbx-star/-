import test from "node:test";
import assert from "node:assert/strict";
import { PaintSurfaceDomain } from "../core/paint-surface-domain.ts";
import {
  rasterLine,
  rasterBrush,
  rasterShape,
  perfectPath,
} from "../core/paint-raster.ts";
import { mirrorCell, mirrorPixel } from "../core/symmetry-space.ts";
test("global chart crosses negative and positive seams on six faces at three steps", () => {
  for (const step of [0.25, 0.125, 0.0625])
    for (let face = 0; face < 6; face++) {
      const a = Math.floor(face / 2),
        t = [0, 1, 2].filter((i) => i !== a),
        cells = [];
      for (const u of [-1, 0, 1]) {
        const p = [0, 0, 0];
        p[t[0]] = u;
        cells.push({ x: p[0], y: p[1], z: p[2] });
      }
      const d = new PaintSurfaceDomain(
        cells,
        new Set(cells.map((c) => `${c.x},${c.y},${c.z}`)),
        step,
      );
      const chart = { face, plane: face % 2 ? 0 : 1 },
        n = step * 64;
      for (const U of [-1, 0, n - 1, n]) {
        const p = d.pixel(chart, U, 0)!;
        assert.equal(p.u, (U + n) % n);
        assert.equal(p.index, p.u);
        assert.equal(d.uv(p)[0], U);
      }
    }
});
test("domain rejects holes, other owners and internal faces against full occupancy", () => {
  const d = new PaintSurfaceDomain(
    [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
    ],
    new Set(["0,0,0"]),
    0.25,
  );
  assert.equal(d.pixel({ face: 4, plane: 1 }, 0, 0), null);
  assert.equal(d.pixel({ face: 5, plane: 0 }, 16, 0), null);
  assert.equal(d.pixel({ face: 5, plane: 0 }, 32, 0), null);
  assert.ok(d.pixel({ face: 5, plane: 0 }, 0, 0));
});
test("deterministic shapes and path repair preserve long corners and remove short redundant elbow", () => {
  assert.deepEqual(rasterLine([0, 0], [3, 0]), [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ]);
  assert.deepEqual(rasterBrush([0, 0], 2, "square"), [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]);
  assert.deepEqual(
    perfectPath([
      [0, 0],
      [1, 0],
      [1, 1],
    ]),
    [
      [0, 0],
      [1, 1],
    ],
  );
  assert.deepEqual(
    perfectPath([
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
    ]),
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
  );
  assert.deepEqual(rasterShape("rectangle", [2, 2], [0, 0], 1, true).length, 9);
  assert.throws(
    () => rasterShape("rectangle", [0, 0], [100000, 100000], 1, true),
    /预算/,
  );
});
test("exact model-space mirror handles cell boundary, centre, pixel normal and even brush", () => {
  const s = {
    axes: [true, false, false] as [boolean, boolean, boolean],
    center: [1, 2, 3] as [number, number, number],
  };
  assert.deepEqual(mirrorCell([0, 0, 0], s, [1, 2, 3], 0.25), [
    [0, 0, 0],
    [-1, 0, 0],
  ]);
  assert.throws(
    () =>
      mirrorCell([0, 0, 0], { ...s, center: [1.01, 2, 3] }, [1, 2, 3], 0.25),
    /半格/,
  );
  const p = {
    key: "0,0,0,0",
    x: 0,
    y: 0,
    z: 0,
    face: 0,
    u: 0,
    v: 1,
    index: 16,
  };
  const out = mirrorPixel(p, s, [1, 2, 3], 0.25);
  assert.equal(out[1].face, 1);
  assert.equal(out[1].x, -1);
  assert.equal(out[1].v, 1);
  const center = { ...s, center: [1.125, 2, 3] as [number, number, number] };
  assert.equal(mirrorCell([0, 0, 0], center, [1, 2, 3], 0.25).length, 1);
});

test("finite selection restricts flood, empty selection refuses, RGB tolerance is explicit", async () => {
  const { PaintSelection, fillPixels } = await import(
    "../core/paint-selection.ts"
  );
  const d = new PaintSurfaceDomain(
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      new Set(["0,0,0", "1,0,0"]),
      0.0625,
    ),
    chart = { face: 4, plane: 1 },
    start = d.pixel(chart, 0, 0)!,
    s = new PaintSelection();
  assert.equal(
    fillPixels(
      d,
      start,
      "plane",
      s,
      (p) => (p.x ? "#121212" : "#101010"),
      0,
      () => true,
    ).length,
    16,
  );
  assert.equal(
    fillPixels(
      d,
      start,
      "plane",
      s,
      (p) => (p.x ? "#121212" : "#101010"),
      2,
      () => true,
    ).length,
    32,
  );
  s.change("4:1", [start], "replace");
  assert.equal(
    fillPixels(
      d,
      start,
      "plane",
      s,
      () => "#101010",
      0,
      () => true,
    ).length,
    1,
  );
  s.invert(d.chartPixels(chart));
  assert.equal(s.keys.size, 31);
  s.change("4:1", [], "replace");
  assert.throws(
    () =>
      fillPixels(
        d,
        start,
        "selection",
        s,
        () => "#101010",
        0,
        () => true,
      ),
    /为空/,
  );
});
