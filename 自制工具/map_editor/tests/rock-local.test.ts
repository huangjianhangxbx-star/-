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

test("growth chips and layer variation controls affect real added geometry", () => {
  const cells = box(0, 1, 32, 40),
    config = {
      ...options,
      operation: "grow" as const,
      maxOutward: 8,
      sides: [0],
    };
  const plain = shapeRock(cells, { ...config, chips: 0 }),
    chipped = shapeRock(cells, { ...config, chips: 0.3 });
  assert.notEqual(
    chipped.addedCells.length,
    plain.addedCells.length,
    "growth chips must not be a dead slider",
  );
  const regular = shapeRock(cells, {
      ...config,
      preset: "terraced-rim",
      layerVariation: 0,
    }),
    varied = shapeRock(cells, {
      ...config,
      preset: "terraced-rim",
      layerVariation: 1,
    });
  assert.notEqual(
    regular.addedCells.length,
    varied.addedCells.length,
    "growth layer variation must not be a dead slider",
  );
});

test("growth inherits source colors, keeps shared-corner additions unique, and rejects over-budget growth atomically", () => {
  const cells = box(0, 1, 64, 64).map((c) => ({ ...c, color: c.y % 3 }));
  const result = shapeRock(cells, {
    ...options,
    operation: "grow",
    maxOutward: 6,
    sides: [0, 2],
  });
  assert(result.addedCells.length > 0);
  assert.equal(new Set(result.cells.map(key)).size, result.cells.length);
  for (const c of result.addedCells)
    if (c.x > 0) assert.equal(c.color, c.y % 3);
  assert.deepEqual(result.removedCellKeys, []);
  const over = shapeRock(cells, {
    ...options,
    operation: "grow",
    maxOutward: 4096,
    sides: [0],
  });
  assert(
    over.diagnostics.blockingReasons.some((s) => s.includes("budget exceeded")),
  );
  assert.equal(over.cells.length, cells.length);
  const original = new Map(cells.map((c) => [key(c), c]));
  for (const c of over.cells) assert.deepEqual(c, original.get(key(c)));
  assert.deepEqual(over.addedCells, []);
  assert.deepEqual(over.removedCellKeys, []);
  for (const maxOutward of [-1, 1.5, 4097])
    assert(
      shapeRock(cells, { ...options, operation: "grow", maxOutward })
        .diagnostics.blockingReasons.length > 0,
    );
});

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
