import test from "node:test";
import assert from "node:assert/strict";
import { EditorDocument } from "../core/document.ts";
import { brushCandidates } from "../core/brush.ts";
import { randomizeVoxels } from "../core/modeling-random.ts";
test("XZ workplane extrudes along Y", () => {
  const e = new EditorDocument();
  const c = brushCandidates(
    e,
    { x: 2, y: 3, z: 4, face: 2 },
    {
      mode: "volume",
      planeAxis: 1,
      action: "add",
      shape: "square",
      size: 1,
      thickness: 2,
      level: 3,
      direction: 1,
      color: 0,
      tag: "",
    },
  );
  assert.deepEqual(
    c.map((p) => [p.x, p.y, p.z]),
    [
      [2, 3, 4],
      [2, 4, 4],
    ],
  );
});
test("random color is deterministic and leaves unselected cells unchanged", () => {
  const cells = [
    { x: 0, y: 0, z: 0, color: 0 },
    { x: 1, y: 0, z: 0, color: 0 },
  ];
  const a = randomizeVoxels(cells, ["#808080"], new Set(["0,0,0"]), {
    kind: "tone",
    amount: 30,
    depth: 2,
    mode: "mixed",
    seed: 3,
  });
  assert.deepEqual(
    a,
    randomizeVoxels(cells, ["#808080"], new Set(["0,0,0"]), {
      kind: "tone",
      amount: 30,
      depth: 2,
      mode: "mixed",
      seed: 3,
    }),
  );
  assert.equal(a.cells[1].color, 0);
  assert.notEqual(a.cells[0].color, 0);
});
test("edge additions obey maximum depth and empty selection is no-op", () => {
  const cells = [{ x: 0, y: 0, z: 0, color: 0 }];
  const o = {
    kind: "edge",
    amount: 100,
    depth: 2,
    mode: "add",
    seed: 3,
  } as const;
  const a = randomizeVoxels(cells, ["#808080"], new Set(["0,0,0"]), o);
  assert.ok(a.cells.length > 1);
  assert.ok(
    a.cells.every((c) => Math.abs(c.x) + Math.abs(c.y) + Math.abs(c.z) <= 2),
  );
  assert.deepEqual(
    randomizeVoxels(cells, ["#808080"], new Set(), o).cells,
    cells,
  );
});

test("removal never touches unselected cells", () => {
  const cells = [0, 1, 2, 3].map((x) => ({ x, y: 0, z: 0, color: 0 }));
  const r = randomizeVoxels(cells, ["#808080"], new Set(["0,0,0", "1,0,0"]), {
    kind: "edge",
    amount: 100,
    depth: 8,
    mode: "remove",
    seed: 3,
  });
  assert.deepEqual(
    r.cells.filter((c) => c.x >= 2),
    cells.slice(2),
  );
});
test("random color supports more than the former 64 colors", () => {
  const cells = Array.from({ length: 100 }, (_, x) => ({
    x,
    y: 0,
    z: 0,
    color: x % 8,
  }));
  const palette = Array.from(
    { length: 64 },
    (_, i) => "#" + (0x203040 + i * 2000).toString(16).padStart(6, "0"),
  );
  const r = randomizeVoxels(
    cells,
    palette,
    new Set(cells.map((c) => [c.x, c.y, c.z].join(","))),
    { kind: "tone", amount: 30, depth: 1, mode: "mixed", seed: 7 },
  );
  assert.ok(r.palette.length > 64);
});

test('surface eraser starts at the hit cell and through eraser traverses its column',()=>{const e=new EditorDocument();e.begin();for(let z=0;z<5;z++)e.put(0,0,z,0,'volume');e.commit();const config={mode:'volume',action:'erase',shape:'square',size:1,thickness:1,level:0,direction:1,color:0,tag:'',through:true};const result=brushCandidates(e,{x:0,y:0,z:5,face:4,cell:e.cells.get('0,0,4')},config);assert.deepEqual(result.filter(p=>p.status==='applied').map(p=>p.z).sort(),[0,1,2,3,4]);});
