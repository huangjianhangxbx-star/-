import test from "node:test";
import assert from "node:assert/strict";
import { createAsset, validateAsset } from "../core/workshop-documents.ts";
import {
  upgradeCanvases,
  CanvasSession,
  canvasAsset,
  alignCanvas,
} from "../core/workshop-canvases.ts";
test("multi canvas source preserves independent precision, source and undo", () => {
  const old = createAsset("old");
  old.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
  const before = JSON.stringify(old);
  const model = upgradeCanvases(old, "new");
  const session = new CanvasSession(model);
  session.add("细节", 0.125);
  const id = session.activeId;
  session.editor.begin();
  session.editor.put(0, 0, 0, 0, "volume");
  session.editor.commit();
  session.sync();
  assert.equal(session.model.canvases![0].cells.length, 1);
  assert.equal(canvasAsset(session.model, id).cells.length, 1);
  assert.equal(JSON.stringify(old), before);
  assert.deepEqual(
    validateAsset(JSON.parse(JSON.stringify(session.model))),
    session.model,
  );
  session.undo();
  assert.equal(canvasAsset(session.model, id).cells.length, 0);
  session.redo();
  assert.equal(canvasAsset(session.model, id).cells.length, 1);
  session.patch({ locked: true });
  assert.throws(() => session.editable(), /锁定/);
  const moved = alignCanvas(session.model, id, [0, 0, 0], [1, 2, 3]);
  assert.deepEqual(moved, [32, 64, 96]);
  assert.throws(() => validateAsset({ ...model, canvases: [] }), /画布/);
  assert.throws(
    () =>
      validateAsset({
        ...model,
        canvases: [{ ...model.canvases![0], voxelStepM: 0.1 }],
      }),
    /画布/,
  );
});
import { exportAssetGlb } from "../core/workshop-glb.ts";
import { validatePublishGlb } from "../core/publish-glb-validation.ts";
test("three canvas GLB preserves each physical size and root, including hidden layers", () => {
  const old = createAsset("sizes");
  old.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
  old.anchorM = [0.25, 0, 0];
  const m = upgradeCanvases(old, "sizes2");
  for (const step of [0.125, 0.0625])
    m.canvases!.push({
      ...structuredClone(m.canvases![0]),
      canvasId: "detail" + step,
      voxelStepM: step,
      originTicks: [16, 0, 0],
      visible: false,
    });
  // canvas IDs are stable machine identifiers, not decimal names.
  m.canvases![1].canvasId = "detail1";
  m.canvases![2].canvasId = "detail2";
  const raw = exportAssetGlb(m);
  validatePublishGlb(raw);
  const json = JSON.parse(
    new TextDecoder().decode(
      raw.slice(20, 20 + new DataView(raw.buffer).getUint32(12, true)),
    ),
  );
  const sizes = json.meshes.map((mesh) => {
    const a = json.accessors[mesh.primitives[0].attributes.POSITION];
    return a.max[0] - a.min[0];
  });
  assert.deepEqual(sizes, [0.25, 0.125, 0.0625]);
  assert.equal(
    json.accessors[json.meshes[0].primitives[0].attributes.POSITION].min[0],
    -0.25,
  );
  assert.equal(
    json.accessors[json.meshes[1].primitives[0].attributes.POSITION].min[0],
    0.25,
  );
});
test("canvas visibility, deletion, reordering and alignment are undoable without resampling", () => {
  const s = new CanvasSession(upgradeCanvases(createAsset("a"), "b"));
  s.add("detail", 0.0625);
  const detail = s.activeId;
  s.patch({ originTicks: [1, -3, 7], visible: false });
  s.undo();
  assert.equal(s.active.visible, true);
  s.redo();
  assert.deepEqual(s.active.originTicks, [1, -3, 7]);
  s.reorder(-1);
  assert.equal(s.model.canvases![0].canvasId, detail);
  s.remove();
  assert.equal(s.model.canvases!.length, 1);
  s.undo();
  assert.equal(s.activeId, detail);
  assert.equal(s.active.voxelStepM, 0.0625);
  assert.throws(
    () =>
      validateAsset({
        ...s.model,
        canvases: s.model.canvases!.map((c) => ({ ...c, canvasId: "same" })),
      }),
    /重复/,
  );
});
import {WorkshopSession} from '../desktop/workshop-session.ts';
import {createScene} from '../core/workshop-documents.ts';
test('multi canvas Root and scene compensation undo together',()=>{
 const manager=new WorkshopSession(),a=manager.openAsset(upgradeCanvases(createAsset('origin'),'model'),null);
 const scene=createScene('scene');scene.assets.push({kind:'voxel',assetId:'model',source:'assets/model.xhmodule.json'});scene.instances.push({instanceId:'one',assetId:'model',positionM:[1,0,0],rotationDeg:0,groupId:'base'});manager.openScene(scene,null);
 manager.reanchor(a.sessionId,[.125,0,0]);assert.equal(manager.sceneSession('scene').snapshot().instances[0].positionM[0],1.125);
 manager.undo(a.sessionId);assert.deepEqual(a.asset.anchorM,[0,0,0]);assert.equal(manager.sceneSession('scene').snapshot().instances[0].positionM[0],1);
 manager.redoScene('scene');assert.deepEqual(a.asset.anchorM,[.125,0,0]);assert.equal(manager.sceneSession('scene').snapshot().instances[0].positionM[0],1.125);
});
