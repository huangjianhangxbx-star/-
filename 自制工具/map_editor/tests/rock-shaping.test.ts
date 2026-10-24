import test from "node:test";
import assert from "node:assert/strict";
import { shapeRock, DEFAULT_ROCK_OPTIONS } from "../core/rock-shaping.ts";
const box = (w = 24, d = 18, h = 30, ox = 0, oy = 0, oz = 0) =>
  Array.from({ length: w * d * h }, (_, i) => ({
    x: ox + (i % w),
    y: oy + (Math.floor(i / w) % d),
    z: oz + Math.floor(i / w / d),
    color: 7,
  }));
const key = (c: any) => `${c.x},${c.y},${c.z}`;
const opts = (extra: any = {}) => ({ ...DEFAULT_ROCK_OPTIONS, ...extra });
test("terrace ledges have visibly different retreat widths rather than equal cake steps", () => {
  const r = shapeRock(
    box(64, 48, 24),
    opts({ preset: "terraced-rim", seed: 17, bandWidth: 12 }),
  );
  const edges = Array.from({ length: 24 }, (_, z) =>
    Math.max(...r.cells.filter((c) => c.z === z && c.y === 24).map((c) => c.x)),
  );
  const unique = [...new Set(edges)],
    widths = unique.slice(1).map((v, i) => unique[i] - v);
  assert(widths.length >= 3);
  assert(Math.max(...widths) >= Math.min(...widths) * 1.5);
});
test("all three full-size column fixtures retain a nonzero structural cut after joint limiting", () => {
  for (const seed of [17, 73, 211]) {
    const r = shapeRock(box(40, 24, 48), opts({ seed }));
    assert(
      r.removedCellKeys.length > 2000,
      `${seed}: ${JSON.stringify(r.diagnostics)}`,
    );
  }
});
test("columns subtract real cells and are independent of input/side order", () => {
  const source = box();
  const copy = JSON.stringify(source);
  const a = shapeRock(source, opts());
  assert(a.removedCellKeys.length > 100);
  assert.equal(JSON.stringify(source), copy);
  const original = new Map(source.map((c) => [key(c), c]));
  for (const c of a.cells) assert.deepEqual(c, original.get(key(c)));
  assert.deepEqual(
    a,
    shapeRock([...source].reverse(), opts({ sides: [3, 1, 0, 2] })),
  );
});
test("zero depth, empty target, locked and hidden are no-ops", () => {
  for (const change of [
    { maxDepth: 0 },
    { targetKeys: new Set() },
    { locked: true },
    { hidden: true },
    { sides: [] },
  ])
    assert.equal(shapeRock(box(), opts(change)).removedCellKeys.length, 0);
});
test("target membership and protected path barriers cannot be bypassed", () => {
  const source = box();
  const target = new Set(source.filter((c) => c.y < 9).map(key));
  const protectedKeys = new Set(source.filter((c) => c.x === 23).map(key));
  assert.equal(
    shapeRock(source, opts({ sides: [0], targetKeys: target, protectedKeys }))
      .removedCellKeys.length,
    0,
  );
  for (const k of shapeRock(source, opts({ targetKeys: target }))
    .removedCellKeys)
    assert(target.has(k));
});
test("column rays stop at first air gap", () => {
  const source = [...box(3, 18, 30), ...box(8, 18, 30, 8)];
  const r = shapeRock(
    source,
    opts({ sides: [1], maxDepth: 8, minThickness: 2 }),
  );
  const retained = new Set(r.cells.map(key));
  for (const c of source.filter((c) => c.x >= 8)) assert(retained.has(key(c)));
});
test("joint four-side result retains minimum interval thickness", () => {
  const r = shapeRock(box(5, 5, 24), opts({ maxDepth: 9 }));
  for (let z = 0; z < 24; z++)
    for (let y = 0; y < 5; y++) {
      const n = r.cells.filter((c) => c.y === y && c.z === z).length;
      assert(n === 0 || n >= 2);
    }
});
test("depth and chips preserve bands and long vertical continuity", () => {
  const a = shapeRock(box(), opts());
  const b = shapeRock(box(), opts({ maxDepth: 5, chips: 0.1 }));
  assert.deepEqual(a.structure.columnBands, b.structure.columnBands);
  const kept = new Set(a.cells.map(key));
  let transitions = 0;
  for (let z = 1; z < 30; z++)
    for (let y = 0; y < 18; y++)
      if (kept.has(`23,${y},${z}`) !== kept.has(`23,${y},${z - 1}`))
        transitions++;
  assert(transitions < 60);
});
test("continuity longer than wall height does not force a synchronized final-row break", () => {
  const source = box(24, 18, 30),
    o = opts({ continuity: 96 });
  assert.deepEqual(
    shapeRock(source, { ...o, breakStrength: 1 }).removedCellKeys,
    shapeRock(source, { ...o, breakStrength: 0 }).removedCellKeys,
  );
});
test("L terraces preserve core, holes and nested occupancy", () => {
  const source = box(32, 28, 20).filter(
    (c) =>
      !(c.x > 17 && c.y > 13) &&
      !(c.x >= 11 && c.x <= 13 && c.y >= 8 && c.y <= 10),
  );
  const o = opts({ preset: "terraced-rim", bandWidth: 6, layers: 4 });
  const r = shapeRock(source, o);
  assert(r.removedCellKeys.length > 100);
  assert.deepEqual(r.diagnostics.blockingReasons, []);
  const kept = new Set(r.cells.map(key));
  for (const c of r.cells)
    if (c.z > 0) assert(kept.has(`${c.x},${c.y},${c.z - 1}`));
  for (let z = 0; z < 20; z++) assert(kept.has(`8,8,${z}`));
  assert.equal(
    shapeRock(source, { ...o, bandWidth: 0 }).removedCellKeys.length,
    0,
  );
  assert.deepEqual(
    r.removedCellKeys,
    shapeRock(source, { ...o, maxDepth: 0 }).removedCellKeys,
  );
});
test("terraces reject stacked, suspended and huge sparse extents atomically", () => {
  for (const source of [
    [...box(10, 10, 3), ...box(10, 10, 3, 0, 0, 6)],
    box(14, 14, 10).filter((c) => !(c.z < 3 && c.x < 5)),
    [
      { x: 0, y: 0, z: 0, color: 0 },
      { x: 1e8, y: 1e8, z: 0, color: 0 },
    ],
  ]) {
    const r = shapeRock(source, opts({ preset: "terraced-rim" }));
    assert.equal(r.removedCellKeys.length, 0);
    assert(r.diagnostics.blockingReasons.length > 0);
  }
});
test("three precisions share lattice geometry and recipes serialize masks", () => {
  const source = box();
  const rs = [0.25, 0.125, 0.0625].map((cellSize) =>
    shapeRock(
      source,
      opts({
        cellSize,
        targetKeys: new Set(source.map(key)),
        protectedKeys: new Set(["0,0,0"]),
      }),
    ),
  );
  assert.deepEqual(rs[0].removedCellKeys, rs[2].removedCellKeys);
  const recipe: any = JSON.parse(JSON.stringify(rs[0].recipe));
  assert(Array.isArray(recipe.options.targetKeys));
  assert.equal(recipe.options.cellSize, 0.25);
});
test("closed perimeter never makes a tail band wider than requested bounds", () => {
  for (let seed = 0; seed < 12; seed++) {
    const r = shapeRock(box(25, 18, 30), opts({ seed, regularity: 0 }));
    for (const b of r.structure.columnBands ?? [])
      assert(b.end - b.start >= 2 && b.end - b.start <= 6);
  }
});
test("terrace protection is an inward barrier and cannot leave protected unsupported caps", () => {
  const source = box(24, 24, 18);
  const r = shapeRock(
    source,
    opts({
      preset: "terraced-rim",
      protectedKeys: new Set(["0,12,17", "0,12,16", "0,12,15"]),
    }),
  );
  assert.equal(r.diagnostics.blockingReasons.length, 0);
  const kept = new Set(r.cells.map(key));
  for (let z = 0; z < 18; z++) assert(kept.has(`0,12,${z}`));
  assert(r.removedCellKeys.length > 0);
});
test("protected barrier in the middle of a column ray stops deeper candidate removals", () => {
  const source = box(20, 18, 30);
  const protectedKeys = new Set(source.filter((c) => c.x === 18).map(key));
  const r = shapeRock(source, opts({ sides: [0], maxDepth: 8, protectedKeys }));
  assert(r.removedCellKeys.length > 0);
  for (const k of r.removedCellKeys) assert.equal(Number(k.split(",")[0]), 19);
});

test("independent column seeds change only their structural stream and reproduce", () => {
  const source=box(),o=opts({maxDepth:6,breakStrength:1,chips:1});
  const base=shapeRock(source,o);
  const broken=shapeRock(source,{...o,randomSeeds:{breaks:73}} as any);
  const layout=(r:any)=>r.structure.columnBands.map(({start,end,depth}:any)=>({start,end,depth}));
  assert.deepEqual(layout(base),layout(broken));
  assert.notDeepEqual(base.structure.columnBands,broken.structure.columnBands);
  assert.notDeepEqual(base.removedCellKeys,broken.removedCellKeys);
  const chipped=shapeRock(source,{...o,randomSeeds:{chips:73}} as any);
  assert.deepEqual(base.structure.columnBands,chipped.structure.columnBands);
  assert.notDeepEqual(base.removedCellKeys,chipped.removedCellKeys);
  const moved=shapeRock(source,{...o,randomSeeds:{layout:73}} as any);
  assert.notDeepEqual(layout(base),layout(moved));
  assert.deepEqual(broken,shapeRock([...source].reverse(),{...o,randomSeeds:{breaks:73}} as any));
  assert.deepEqual(base.cells,shapeRock(source,{...o,randomSeeds:{layout:0,breaks:0,chips:0}} as any).cells);
});

test("terrace and contour seeds are independent and survive recipe serialization", () => {
  const source=box(32,28,20),o=opts({preset:'terraced-rim',bandWidth:8});
  const base=shapeRock(source,o);
  const contour=shapeRock(source,{...o,randomSeeds:{contour:73}} as any);
  assert.deepEqual(base.structure.layers,contour.structure.layers);
  assert.notDeepEqual(base.removedCellKeys,contour.removedCellKeys);
  const levels=shapeRock(source,{...o,randomSeeds:{terraces:73}} as any);
  assert.notDeepEqual(base.structure.layers,levels.structure.layers);
  const recipe=JSON.parse(JSON.stringify(contour.recipe));
  assert.deepEqual(contour.cells,shapeRock(source,recipe.options).cells);
  const invalid=shapeRock(source,{...o,randomSeeds:{contour:1.5}} as any);
  assert.ok(invalid.diagnostics.blockingReasons.length);
  assert.equal(invalid.removedCellKeys.length,0);
});
