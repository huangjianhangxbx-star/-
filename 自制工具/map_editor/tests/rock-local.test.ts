import test from "node:test";
import assert from "node:assert/strict";
import {
  shapeRock,
  DEFAULT_ROCK_OPTIONS,
  type RockCell,
} from "../core/rock-shaping.ts";
const key = (c: RockCell) => `${c.x},${c.y},${c.z}`;
const box = (ox = 0, w = 20, d = 12, h = 24): RockCell[] =>
  Array.from({ length: w * d * h }, (_, i) => ({
    x: ox + (i % w),
    y: Math.floor(i / w) % d,
    z: Math.floor(i / w / d),
    color: 0,
  }));
const options = { ...DEFAULT_ROCK_OPTIONS, localSurface: true };

test("local planning bounds sparse extents without modifying source", () => {
  const source = [
    { x: 0, y: 0, z: 0, color: 0 },
    { x: 100001, y: 0, z: 0, color: 0 },
  ];
  const result = shapeRock(source, options);
  assert(
    result.diagnostics.blockingReasons.some((s) =>
      s.includes("budget exceeded"),
    ),
  );
  assert.deepEqual(result.cells, source);
  assert.deepEqual(result.removedCellKeys, []);
});

test("local carving is reproducible across precision and input order and honors normal backing and seed streams", () => {
  const cells = box(),
    scopeKeys = new Set(
      cells.filter((c) => c.x === 19 && c.y >= 2 && c.y < 10).map(key),
    );
  const a = shapeRock(cells, {
    ...options,
    scopeKeys,
    sides: [0],
    minThickness: 4,
    maxDepth: 5,
  });
  assert(a.removedCellKeys.length > 100);
  assert.deepEqual(
    a,
    shapeRock([...cells].reverse(), {
      ...options,
      scopeKeys,
      sides: [0],
      minThickness: 4,
      maxDepth: 5,
    }),
  );
  assert.deepEqual(
    a.removedCellKeys,
    shapeRock(cells, {
      ...options,
      scopeKeys,
      sides: [0],
      minThickness: 4,
      maxDepth: 5,
      cellSize: 0.0625,
    }).removedCellKeys,
  );
  assert.deepEqual(
    a.structure.columnBands,
    shapeRock(cells, {
      ...options,
      scopeKeys,
      sides: [0],
      minThickness: 4,
      maxDepth: 5,
      randomSeeds: { chips: 73 },
    }).structure.columnBands,
  );
  assert.notDeepEqual(
    a.structure.columnBands,
    shapeRock(cells, {
      ...options,
      scopeKeys,
      sides: [0],
      minThickness: 4,
      maxDepth: 5,
      randomSeeds: { layout: 73 },
    }).structure.columnBands,
  );
  for (const k of a.removedCellKeys) assert(scopeKeys.has(k));
});

test("local cuts retain connectivity through a narrow bridge instead of rejecting safe carving elsewhere", () => {
  const source = [
    ...box(0, 8, 12, 20),
    ...box(12, 8, 12, 20),
    ...Array.from({ length: 4 }, (_, i) => ({
      x: 8 + i,
      y: 5,
      z: 8,
      color: 0,
    })),
  ];
  for (const preset of ["columnar-wall", "terraced-rim"] as const) {
    const result = shapeRock(source, {
      ...options,
      preset,
      maxDepth: 14,
      bandWidth: 14,
      minThickness: 2,
    });
    assert.equal(result.diagnostics.blockingReasons.length, 0);
    assert(result.removedCellKeys.length > 0);
    const remaining = new Map(result.cells.map((c) => [key(c), c])),
      queue = [result.cells[0]],
      seen = new Set([key(queue[0])]);
    for (let i = 0; i < queue.length; i++)
      for (const [dx, dy, dz] of [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ]) {
        const c = queue[i],
          k = `${c.x + dx},${c.y + dy},${c.z + dz}`;
        if (remaining.has(k) && !seen.has(k)) {
          seen.add(k);
          queue.push(remaining.get(k)!);
        }
      }
    assert.equal(seen.size, remaining.size);
  }
});
