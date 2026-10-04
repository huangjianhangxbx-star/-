import { test } from "node:test";
import assert from "node:assert/strict";
import { createAsset, createScene } from "../core/workshop-documents.ts";
import { transformPoint } from "../core/coordinates.ts";
import { WorkshopSession } from "../desktop/workshop-session.ts";
import {cloneAsset} from '../core/asset-copy.ts';
import {createReference} from '../core/references.ts';
let api: any = {};
try {
  api = await import("../core/scene-session.ts");
} catch (e) {
  if (
    e.code !== "ERR_MODULE_NOT_FOUND" ||
    !e.url.endsWith("/core/scene-session.ts")
  )
    throw e;
}
test('deleting the local origin preserves Root, all placements and PNG frame; another scene copy stays isolated',()=>{
 const source=createAsset('a');source.cells=[{x:0,y:0,z:0,color:0,owner:'volume'}];
 source.editor={reference:createReference({id:'reference',name:'PNG比例参考',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGN4ppHyH4QZYAwAVugJxfB+DTwAAAAASUVORK5CYII=',pixelWidth:2,pixelHeight:2})};
 const copy=cloneAsset(source,'b'),m=new WorkshopSession(),a=m.openAsset(source,'a'.repeat(64)),b=m.openAsset(copy,'b'.repeat(64));
 const sa=createScene('scene-a'),sb=createScene('scene-b');for(const [scene,asset] of [[sa,source],[sb,copy]] as const){scene.assets.push({kind:'voxel',assetId:asset.assetId,source:`assets/${asset.assetId}.xhmodule.json`});scene.instances.push({instanceId:'i',assetId:asset.assetId,positionM:[1,0,0],rotationDeg:90,groupId:'base'});m.openScene(scene,'c'.repeat(64));}
 const beforeA=m.sceneSession('scene-a').snapshot(),beforeB=m.sceneSession('scene-b').snapshot(),reference=structuredClone(a.asset.editor);
 a.editor.begin();a.editor.volume(0,0,0,0,true);a.editor.commit();m.sync(a.sessionId);
 assert.equal(a.asset.cells.length,0);assert.deepEqual(a.asset.anchorM,[0,0,0]);assert.deepEqual(a.asset.editor,reference);assert.deepEqual(m.sceneSession('scene-a').snapshot(),beforeA);assert.deepEqual(m.sceneSession('scene-b').snapshot(),beforeB);assert.equal(b.asset.cells.length,1);assert.equal(b.editor.past.length,0);assert.deepEqual(m.dirtyDocuments(),['a']);
 m.reanchor(a.sessionId,[.25,.25,0]);m.undoScene('scene-a');assert.equal(a.asset.cells.length,0);assert.deepEqual(a.asset.anchorM,[0,0,0]);assert.deepEqual(m.sceneSession('scene-a').snapshot().instances,beforeA.instances);assert.deepEqual(m.sceneSession('scene-b').snapshot(),beforeB);
});
function fixture() {
  const asset = createAsset("a");
  asset.anchorM = [0.125, -0.125, 0.125];
  asset.rootMode = "legacy";
  asset.cells = [{ x: 3, y: -2, z: 4, color: 0 }];
  const scene = createScene("s");
  scene.assets.push({
    kind: "voxel",
    assetId: "a",
    source: "assets/a.xhmodule.json",
  });
  for (let i = 0; i < 4; i++)
    scene.instances.push({
      instanceId: `i${i}`,
      assetId: "a",
      positionM: transformPoint(asset.anchorM, [0, 0, 0], [i, 0, 0], i * 90),
      rotationDeg: i * 90,
      groupId: "base",
    });
  assert.equal(typeof api.SceneSession, "function");
  return {
    asset,
    scene,
    session: new api.SceneSession(
      scene,
      new Map([["a", { kind: "voxel", document: asset }]]),
    ),
  };
}
test("horizontal decals keep independent identity and dimensions through copy, transform and undo", () => {
  const scene = createScene("decal-scene");
  scene.assets.push({
    kind: "texture",
    assetId: "png",
    revision: 0,
    image: "textures/png.png",
  });
  const session = new api.SceneSession(scene, new Map());
  assert.equal(typeof session.addDecal, "function");
  session.addDecal({
    decalId: "d",
    assetId: "png",
    positionM: [0, 0, 0],
    rotationDeg: 0,
    widthM: 2,
    heightM: 3,
  });
  session.duplicate("d", "copy");
  session.transform("copy", [1.23, -0.6, 0.2], 90);
  session.resizeDecal("copy", 4, 5);
  assert.equal(session.snapshot().decals[0].widthM, 2);
  assert.equal(session.snapshot().decals[1].heightM, 5);
  session.undo();
  assert.equal(session.snapshot().decals[1].heightM, 3);
  session.remove("copy");
  assert.equal(session.snapshot().decals.length, 1);
  session.undo();
  assert.equal(session.snapshot().decals.length, 2);
  assert.throws(() => session.resizeDecal("d", 0, 3));
});
test("scene commands preserve registration and independent copies; floating geometry needs no support cells", () => {
  const { session } = fixture();
  session.duplicate("i0", "copy");
  session.transform("copy", [1.125, -0.125, 0.125], 0);
  assert.equal(session.snapshot().instances.length, 5);
  assert.deepEqual(
    session.snapshot().instances[0].positionM,
    [0.125, -0.125, 0.125],
  );
  session.setGroupVisible("base", false);
  session.undo();
  assert.equal(session.snapshot().groups[0].visible, true);
  session.remove("copy");
  session.undo();
  session.redo();
  assert.equal(session.snapshot().instances.length, 4);
  assert.throws(() => session.transform("i0", [0, 0, 0], 0), /对齐/);
  assert.throws(() => session.duplicate("i0", "i1"));
  const leaked = session.snapshot();
  leaked.instances[0].positionM[0] = 99;
  assert.equal(session.snapshot().instances[0].positionM[0], 0.125);
});
test("Root proposal does not mutate; compensation preserves all corners for every rotation", () => {
  const { asset, session } = fixture(),
    before = session.snapshot();
  const change = session.prepareReanchor("a", [0.5, -0.75, 1]);
  assert.deepEqual(session.snapshot(), before);
  for (let i = 0; i < 4; i++)
    for (const p of [
      [0.75, -0.5, 1],
      [1, -0.25, 1.25],
    ]) {
      assert.deepEqual(
        transformPoint(
          p as any,
          asset.anchorM,
          before.instances[i].positionM,
          i * 90,
        ),
        transformPoint(
          p as any,
          change.afterAsset.anchorM,
          change.afterScene.instances[i].positionM,
          i * 90,
        ),
      );
    }
});
test("joint Root history blocks half undo after newer edits, then restores both participants", () => {
  const { asset, scene } = fixture(),
    m = new WorkshopSession(),
    a = m.openAsset(asset, "a".repeat(64));
  const s = m.openScene(scene, "b".repeat(64));
  const before = s.snapshot();
  const proposal = m.prepareReanchor(a.sessionId, [0.5, -0.75, 1]);
  m.commitRootChange(proposal);
  assert.deepEqual(a.asset.anchorM, [0.5, -0.75, 1]);
  assert.deepEqual(s.snapshot().instances[0].positionM, [0.5, -0.75, 1]);
  a.editor.begin();
  a.editor.volume(7, 8, 9, 0);
  a.editor.commit();
  m.sync(a.sessionId);
  assert.throws(() => m.undoScene("s"), /后续/);
  assert.equal(a.asset.cells.length, 2);
  m.undo(a.sessionId);
  m.undoScene("s");
  assert.deepEqual(a.asset.anchorM, asset.anchorM);
  assert.deepEqual(s.snapshot().instances, before.instances);
  m.redo(a.sessionId);
  assert.deepEqual(a.asset.anchorM, [0.5, -0.75, 1]);
  assert.throws(() => s.undo(), /联合/);
  assert.ok(m.dirtyDocuments().includes("a"));
  assert.ok(m.dirtyScenes().includes("s"));
  assert.throws(() => m.commitRootChange(proposal), /过期/);
});
test("scene edits block module-side joint undo and redo preserves ordinary command order", () => {
  const { asset, scene } = fixture(),
    m = new WorkshopSession(),
    a = m.openAsset(asset, null),
    s = m.openScene(scene, null);
  m.reanchor(a.sessionId, [0.5, 0, 0.75]);
  s.setGroupVisible("base", false);
  const before = s.snapshot();
  assert.throws(() => m.undo(a.sessionId), /后续/);
  assert.deepEqual(s.snapshot(), before);
  m.undoScene("s");
  m.undo(a.sessionId);
  assert.deepEqual(a.asset.anchorM, asset.anchorM);
  m.redoScene("s");
  m.redoScene("s");
  assert.equal(s.snapshot().groups[0].visible, false);
  assert.deepEqual(a.asset.anchorM, [0.5, 0, 0.75]);
});
test("geometry edits leave all instance transforms and explicit Root unchanged", () => {
  const { asset, scene } = fixture(),
    m = new WorkshopSession(),
    a = m.openAsset(asset, null),
    s = m.openScene(scene, null);
  const before = s.snapshot();
  a.editor.begin();
  a.editor.volume(0, 0, 0, 0);
  a.editor.commit();
  m.sync(a.sessionId);
  assert.deepEqual(s.snapshot(), before);
  assert.deepEqual(a.asset.anchorM, asset.anchorM);
  m.undo(a.sessionId);
  assert.deepEqual(s.snapshot(), before);
  assert.deepEqual(a.asset.anchorM, asset.anchorM);
});
test("cancelled and stale Root proposals cannot mutate either participant", () => {
  const { asset, scene } = fixture(),
    m = new WorkshopSession(),
    a = m.openAsset(asset, "a".repeat(64)),
    s = m.openScene(scene, "b".repeat(64));
  const proposal = m.prepareReanchor(a.sessionId, [0.5, 0, 0]);
  assert.deepEqual(m.dirtyDocuments(), []);
  assert.deepEqual(m.dirtyScenes(), []);
  s.remove("i3");
  const before = s.snapshot();
  assert.throws(() => m.commitRootChange(proposal), /过期/);
  assert.deepEqual(a.asset.anchorM, asset.anchorM);
  assert.deepEqual(s.snapshot(), before);
  assert.throws(() => m.prepareReanchor(a.sessionId, [0.125, 0, 0]));
});
test("placing instances after an earlier local Root command blocks unsafe module-only undo", () => {
  const m = new WorkshopSession(),
    asset = createAsset("a"),
    scene = createScene("s");
  scene.assets.push({
    kind: "voxel",
    assetId: "a",
    source: "assets/a.xhmodule.json",
  });
  const a = m.openAsset(asset, null),
    s = m.openScene(scene, null);
  m.reanchor(a.sessionId, [0.5, 0, 0]);
  s.add({
    instanceId: "i",
    assetId: "a",
    positionM: [0.5, 0, 0],
    rotationDeg: 0,
    groupId: "base",
  });
  assert.throws(() => m.undo(a.sessionId), /后续/);
  assert.deepEqual(a.asset.anchorM, [0.5, 0, 0]);
  m.undoScene("s");
  m.undo(a.sessionId);
  assert.deepEqual(a.asset.anchorM, [0, 0, 0]);
});
test("save capture freezes both Root participants; late receipts leave later joint edits dirty", async () => {
  const { asset, scene } = fixture(),
    m = new WorkshopSession(),
    a = m.openAsset(asset, null);
  m.openScene(scene, null);
  const { captureWorkshopSave } = await import("../desktop/workshop-save.ts");
  const { createProject } = await import("../core/workshop-documents.ts");
  const p = createProject("p");
  p.scenes.push({
    sceneId: "s",
    name: "",
    source: "scenes/s/scene.xhscene.json",
  });
  const save = captureWorkshopSave(p, [scene], m);
  m.reanchor(a.sessionId, [0.5, -0.75, 1]);
  const frozenAsset = save.writes.find((w) => w.kind === "asset").document;
  const frozenScene = save.writes.find((w) => w.kind === "scene").document;
  assert.deepEqual(frozenAsset.anchorM, asset.anchorM);
  assert.deepEqual(frozenScene.instances, scene.instances);
  m.markSaved(a.sessionId, save.assets[0].revision, "c".repeat(64));
  m.markSceneSaved("s", save.scenes[0].revision);
  assert.deepEqual(m.dirtyDocuments(), ["a"]);
  assert.deepEqual(m.dirtyScenes(), ["s"]);
});
