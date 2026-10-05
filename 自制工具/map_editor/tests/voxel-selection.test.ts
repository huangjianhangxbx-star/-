import test from "node:test";
import assert from "node:assert/strict";
import { VoxelSelection, filterExactCells } from "../core/voxel-selection.ts";
import { EditorDocument } from "../core/document.ts";
import { EditOperationSession } from "../core/edit-operation.ts";
import { creativeConfig } from "../core/creative-build.ts";
const cells = [
  { x: -1, y: 0, z: 0, color: 0, owner: "height" },
  { x: 0, y: 0, z: 0, color: 1, owner: "volume" },
  { x: 1, y: 0, z: 0, color: 0, owner: "volume" },
];
test("irregular selection uses exact keys, snapshots and derived bounds", () => {
  const s = new VoxelSelection();
  s.replace([cells[0], cells[2]]);
  assert.equal(s.count, 2);
  assert.deepEqual(s.bounds, { min: [-1, 0, 0], max: [1, 0, 0] });
  assert.deepEqual(filterExactCells(cells, s.keys), [cells[0], cells[2]]);
  s.add([cells[1]]);
  s.subtract(["-1,0,0"]);
  assert.equal(s.count, 2);
  assert.equal(s.snapshot.has("-1,0,0"), false);
});
test("clear keeps selection and fill restores owners, geometry history only", () => {
  const e = new EditorDocument();
  e.begin();
  for (const c of cells) e.put(c.x, c.y, c.z, c.color, c.owner);
  e.commit();
  const s = new VoxelSelection();
  s.replace([cells[0], cells[2]]);
  const op = new EditOperationSession(e);
  const run = (action) => {
    op.begin(creativeConfig(2, "add"));
    const p = op.selection(s, action, 2);
    op.apply(p);
    op.commit();
    return p;
  };
  assert.equal(e.past.length, 1);
  run("clear");
  assert.equal(s.count, 2);
  assert.deepEqual([...e.cells.keys()], ["0,0,0"]);
  run("fill");
  assert.equal(e.cells.get("-1,0,0").owner, "height");
  assert.equal(e.cells.get("-1,0,0").color, 2);
  assert.equal(e.cells.get("0,0,0").color, 1);
  assert.equal(e.past.length, 3);
  e.undo();
  assert.equal(e.cells.size, 1);
  assert.equal(s.count, 2);
  e.redo();
  assert.equal(e.cells.size, 3);
});
test("replace leaves missing cells empty and preserves owner with no-op history", () => {
  const e = new EditorDocument();
  e.begin();
  e.put(-1, 0, 0, 0, "height");
  e.commit();
  const s = new VoxelSelection();
  s.replace(cells);
  const op = new EditOperationSession(e);
  op.begin(creativeConfig(2, "add"));
  const p = op.selection(s, "replace", 2);
  assert.equal(p.summary.applied, 1);
  op.apply(p);
  op.commit();
  assert.equal(e.cells.size, 1);
  assert.equal(e.cells.get("-1,0,0").owner, "height");
  op.begin(creativeConfig(2, "add"));
  op.apply(op.selection(s, "replace", 2));
  op.commit();
  assert.equal(e.past.length, 2);
});
test("selection chunk cancel rolls back all geometry", async () => {
  const e = new EditorDocument();
  e.begin();
  for (const c of cells) e.put(c.x, c.y, c.z, c.color, c.owner);
  e.commit();
  const before = structuredClone(e.doc),
    s = new VoxelSelection();
  s.replace(cells);
  const op = new EditOperationSession(e);
  op.begin(creativeConfig(0, "add"));
  await op.executeChunked(op.selection(s, "clear", 0), 1, async () =>
    op.cancel(),
  );
  assert.deepEqual(e.doc, before);
  assert.equal(s.count, 3);
});
test("fill preflights budget without partial writes", () => {
  const e = new EditorDocument();
  for (let x = 0; x < 250000; x++)
    e.cells.set(`${x},0,0`, { x, y: 0, z: 0, color: 0, owner: "volume" });
  const s = new VoxelSelection();
  s.add([{ x: 0, y: 1, z: 0, color: 0, owner: "height" }]);
  const op = new EditOperationSession(e);
  op.begin(creativeConfig(1, "add"));
  assert.throws(() => op.selection(s, "fill", 1), /预算/);
  assert.equal(e.cells.size, 250000);
  op.cancel();
  assert.equal(e.past.length, 0);
});
