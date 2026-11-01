import test from "node:test";
import assert from "node:assert/strict";
import { createAsset, validateAsset } from "../core/workshop-documents.ts";
import { CanvasSession } from "../core/workshop-canvases.ts";
import { VoxelSelection } from "../core/voxel-selection.ts";
import { VoxelPlacementSession } from "../desktop/voxel-placement.ts";
import {
  applyGizmoTransform,
  planGizmoTransform,
} from "../core/voxel-gizmo.ts";

const cell = (x: number, color = 0) => ({
  x,
  y: 0,
  z: 0,
  color,
  owner: "volume" as const,
});
function fixture() {
  const asset = createAsset("escape-copy");
  asset.cells = [cell(0), cell(5, 1)];
  const session = new CanvasSession(asset),
    owner = session.model.objects!.find((o) => o.cellKeys!.includes("0,0,0"))!;
  session.setEditObject(owner.objectId);
  const selection = new VoxelSelection();
  selection.replace(session.editor.cells.values());
  return { session, selection, owner: owner.objectId };
}
function pasteAtSource(session: CanvasSession, selection: VoxelSelection) {
  const placement = new VoxelPlacementSession();
  placement.copy(session.editor, selection, "asset");
  placement.begin("paste", session.editor, selection, "asset");
  placement.place(session.editor, [30, 0, 0]);
  const preview = placement.place(session.editor, placement.source!.origin);
  session.editor.begin();
  session.editor.addVoxelCopy("new-copy", preview.destination);
  session.editor.commit();
  selection.replace(preview.destination);
  placement.cancel();
  session.sync();
  return preview;
}
test("Edit-mode source-position paste retains independent copy identity through sync, movement and reload", () => {
  const { session, selection, owner } = fixture();
  pasteAtSource(session, selection);
  assert.equal(
    session.editor.doc.voxelCopies?.[0].copyId,
    "new-copy",
    "sync must retain the selected new copy rather than flatten its overlap",
  );
  assert.deepEqual(
    session.editor.doc.baseCells.map((c: any) => c.x),
    [0],
  );
  const plan = planGizmoTransform(
    session.editor,
    [...selection.snapshot.values()],
    { kind: "move", delta: [2, 0, 0] },
    "new-copy",
  );
  applyGizmoTransform(session.editor, plan);
  session.sync();
  assert.deepEqual(
    session.active.cells.map((c) => c.x).sort((a, b) => a - b),
    [0, 2, 5],
    "moving the new copy preserves the original and other object",
  );
  assert.deepEqual(
    session.model.objects!.find((o) => o.objectId === owner)!.cellKeys!.sort(),
    ["0,0,0", "2,0,0"],
  );
  const reopened = new CanvasSession(
    validateAsset(JSON.parse(JSON.stringify(session.model))),
  );
  reopened.setEditObject(owner);
  assert.deepEqual(
    reopened.editor.doc.cells
      .map((c: any) => c.x)
      .sort((a: number, b: number) => a - b),
    [0, 2],
  );
  assert.equal(reopened.editor.doc.voxelCopies[0].copyId, "new-copy");
});
test("Edit-mode paste blocks another owner and preserves existing source layers outside its edit scope", () => {
  const { session, selection, owner } = fixture();
  session.setEditObject(null);
  session.editor.begin();
  session.editor.addVoxelCopy("foreign-copy", [cell(5, 2)]);
  session.editor.commit();
  session.sync();
  const foreign = structuredClone(
    session.active.voxelCopies!.find((c) => c.copyId === "foreign-copy"),
  );
  session.setEditObject(owner);
  pasteAtSource(session, selection);
  const plan = planGizmoTransform(
    session.editor,
    [...selection.snapshot.values()],
    { kind: "move", delta: [5, 0, 0] },
    "new-copy",
  );
  applyGizmoTransform(session.editor, plan);
  session.sync();
  assert.deepEqual(
    session.active.voxelCopies!.find((c) => c.copyId === "foreign-copy"),
    foreign,
    "another object source group must not be lost or recolored",
  );
  assert.equal(session.active.cells.find((c) => c.x === 5)!.color, 2);
  assert.deepEqual(
    session.model.objects!.find((o) => o.objectId === owner)!.cellKeys,
    ["0,0,0"],
  );
  assert.deepEqual(
    session.editor.doc.cells.map((c: any) => c.x),
    [0],
  );
});
test("a source group spanning multiple owners retains its foreign cells while editing one owner", () => {
  const { session, owner } = fixture();
  session.setEditObject(null);
  session.editor.begin();
  session.editor.addVoxelCopy("shared-copy", [cell(0, 2), cell(5, 3)]);
  session.editor.commit();
  session.sync();
  session.setEditObject(owner);
  assert.deepEqual(
    session.editor.doc.voxelCopies[0].cells.map((c: any) => c.x),
    [0],
    "edit proxy must expose only the current owner",
  );
  const plan = planGizmoTransform(
    session.editor,
    [...session.editor.cells.values()],
    { kind: "move", delta: [2, 0, 0] },
    "shared-copy",
  );
  applyGizmoTransform(session.editor, plan);
  session.sync();
  assert.deepEqual(
    session.active.voxelCopies![0].cells.map((c) => c.x).sort((a, b) => a - b),
    [2, 5],
  );
  assert.equal(session.active.cells.find((c) => c.x === 5)!.color, 3);
  const unchanged = JSON.stringify(session.model),
    depth = session.past.length;
  session.sync();
  assert.equal(
    JSON.stringify(session.model),
    unchanged,
    "read-only sync must preserve source layers exactly",
  );
  assert.equal(session.past.length, depth);
  session.undo();
  assert.deepEqual(
    session.active.voxelCopies![0].cells.map((c) => c.x),
    [0, 5],
  );
  session.redo();
  assert.deepEqual(
    session.active.voxelCopies![0].cells.map((c) => c.x).sort((a, b) => a - b),
    [2, 5],
  );
});
