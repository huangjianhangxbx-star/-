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

test("Z faces sculpt selected top and bottom surfaces in both presets and all three operations", () => {
  const cells = box(0, 32, 28, 12),
    before = new Set(cells.map(key));
  for (const side of [4, 5])
    for (const preset of ["columnar-wall", "terraced-rim"] as const)
      for (const operation of ["subtract", "grow", "both"] as const) {
        const z = side === 4 ? 11 : 0,
          scopeKeys = new Set(
            cells
              .filter(
                (c) =>
                  c.z === z && c.x >= 2 && c.x < 30 && c.y >= 2 && c.y < 26,
              )
              .map(key),
          );
        const result = shapeRock(cells, {
          ...options,
          preset,
          operation,
          sides: [side],
          scopeKeys,
          maxOutward: 4,
          maxDepth: 4,
          bandWidth: 4,
        });
        assert.deepEqual(
          result.diagnostics.blockingReasons,
          [],
          `${preset}/${operation}/${side}`,
        );
        if (operation !== "subtract")
          assert(
            result.addedCells.length > 0,
            "Z growth must extend beyond the input volume",
          );
        if (operation !== "grow")
          assert(
            result.removedCellKeys.length > 0,
            "Z cuts must affect the selected surface",
          );
        for (const c of result.addedCells) {
          assert(!before.has(key(c)));
          assert(scopeKeys.has(`${c.x},${c.y},${z}`));
          assert(side === 4 ? c.z > 11 && c.z <= 15 : c.z < 0 && c.z >= -4);
        }
        for (const k of result.removedCellKeys) assert(scopeKeys.has(k));
        const depth = (x: number, y: number) =>
          result.addedCells.filter((c) => c.x === x && c.y === y).length;
        if (operation === "grow") {
          assert(
            new Set(Array.from({ length: 28 }, (_, x) => depth(x + 2, 14)))
              .size > 1,
            "cap field must vary along X",
          );
          assert(
            new Set(Array.from({ length: 24 }, (_, y) => depth(16, y + 2)))
              .size > 1,
            "cap field must vary along Y, not be rotated side stripes",
          );
        }
      }
});

test("six-face growth joins side/cap corners without duplicate occupancy or exceeding limits", () => {
  const cells = box(0, 8, 12, 8),
    config = {
      ...options,
      operation: "grow" as const,
      maxOutward: 4,
      sides: [0, 4],
    };
  const result = shapeRock(cells, config);
  assert(
    result.addedCells.some((c) => c.x > 7 && c.z > 7),
    "side and top extrusions need a connected corner transition",
  );
  assert(
    result.addedCells.every(
      (c) => c.x <= 11 && c.z <= 11 && c.y >= 0 && c.y < 12,
    ),
  );
  assert.equal(new Set(result.cells.map(key)).size, result.cells.length);
  assert.deepEqual(
    result,
    shapeRock([...cells].reverse(), { ...config, sides: [4, 0] }),
  );
  const six = shapeRock(cells, { ...config, sides: [0, 1, 2, 3, 4, 5] });
  assert.equal(new Set(six.cells.map(key)).size, six.cells.length);
  assert.equal(six.removedCellKeys.length, 0);
  assert(six.addedCells.some((c) => c.z < 0));
  assert(six.addedCells.some((c) => c.z > 7));
});

test("cap corner transitions respect selected roots, protected empty space and foreign occupancy", () => {
  const cells = box(0, 8, 12, 8),
    scopeKeys = new Set(["7,5,7"]),
    targetKeys = new Set(cells.map(key));
  const config = {
    ...options,
    operation: "grow" as const,
    maxOutward: 4,
    sides: [0, 4],
    scopeKeys,
    targetKeys,
  };
  const obstacle = { x: 8, y: 5, z: 8, color: 2 };
  for (const result of [
    shapeRock([...cells, obstacle], config),
    shapeRock(cells, { ...config, protectedKeys: new Set([key(obstacle)]) }),
  ]) {
    assert(result.addedCells.length > 0);
    assert(
      !result.addedCells.some((c) => c.x >= 8 && c.z >= 8),
      "corner growth cannot pass a blocked inward corner",
    );
    assert(result.addedCells.every((c) => c.y === 5));
  }
});

test("signed terrace jitter cannot exceed either explicit inward or outward limit", () => {
  const cells = box(0, 32, 128, 16);
  const result = shapeRock(cells, {
    ...options,
    preset: "terraced-rim",
    operation: "both",
    maxOutward: 16,
    bandWidth: 16,
    layerVariation: 1,
    contourScale: 6,
    sides: [0],
  });
  assert(
    result.addedCells.every((c) => c.x <= 47),
    "outward jitter must respect the 16-cell maximum",
  );
  assert(
    result.removedCellKeys.every((k) => Number(k.split(",")[0]) >= 16),
    "inward jitter must respect the 16-cell maximum",
  );
});

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
