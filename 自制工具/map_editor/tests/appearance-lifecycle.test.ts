import { test } from "node:test";
import assert from "node:assert/strict";
import { createAsset } from "../core/workshop-documents.ts";
import {
  CanvasSession,
  ensureModelObjects,
} from "../core/workshop-canvases.ts";
import { planAppearance } from "../core/appearance-asset.ts";
import { meshMap } from "../core/mesher.ts";
import { exportAssetGlb } from "../core/workshop-glb.ts";
function fixture() {
  const a = createAsset("appearance-life");
  a.cells = [
    { x: 0, y: 0, z: 0, color: 0 },
    { x: 3, y: 0, z: 0, color: 0 },
  ];
  const s = new CanvasSession(ensureModelObjects(a));
  s.applyAppearance(
    planAppearance(s.model, s.activeId, new Set(["0,0,0"]), {
      kind: "tone",
      preset: "up-down",
      strength: 0.4,
      light: [0, 0, 1],
      bands: 3,
      affectPaint: false,
    }),
  );
  return s;
}
test("tone survives object copy and movement, deletion cleans its owner", () => {
  const s = fixture(),
    o = s.model.objects!.find((o) => o.cellKeys!.includes("0,0,0"))!;
  s.selectObject(o.objectId);
  const ids = s.pasteObjects(s.copyObjects([o.objectId]));
  assert(ids.length);
  const pasted = s.model.objects!.find((o) => o.objectId === ids[0])!,
    k = pasted.cellKeys![0];
  assert(s.active.faceTone!.faces[k + ",5"]);
  s.moveObjects([o.objectId], [0, 0, 8]);
  assert(s.active.faceTone!.faces["0,0,1,5"]);
  assert.equal(s.active.faceTone!.faces["0,0,0,5"], undefined);
  s.removeObjects([o.objectId]);
  assert.equal(s.active.faceTone!.faces["0,0,1,5"], undefined);
});
test("mesher and GLB keep face gains separate with no PNG for plain toned faces", () => {
  const s = fixture();
  const c = s.active,
    q = meshMap({ ...s.editor.doc, faceTone: c.faceTone });
  assert(q.some((v) => v.gain === 0.6 && v.axis === 2 && v.sign === -1));
  const bytes = exportAssetGlb(s.model),
    dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    json = JSON.parse(
      new TextDecoder().decode(bytes.slice(20, 20 + dv.getUint32(12, true))),
    );
  assert.equal((json.images ?? []).length, 0);
  assert(json.materials.some((m: any) => m.name?.includes("tone")));
});
import { createScene, type Vec3 } from "../core/workshop-documents.ts";
import { mergeSceneInstances } from "../core/scene-join.ts";
import { separateCanvasCells } from "../core/model-objects.ts";
test("rotation, source partition and three-canvas overwrite retain the correct owner and face", () => {
  const s = fixture(),
    o = s.model.objects!.find((o) => o.cellKeys!.includes("0,0,0"))!;
  s.active.faceTone!.faces["0,0,0,0"] = { gain: 0.37, affectPaint: true };
  s.rotateObjects([o.objectId], 2, 1);
  const owner = s.model.objects!.find((v) => v.objectId === o.objectId)!
    .cellKeys![0];
  assert.deepEqual(s.active.faceTone!.faces[owner + ",2"], {
    gain: 0.37,
    affectPaint: true,
  });
  const source = structuredClone(s.active),
    split = separateCanvasCells(source, [
      source.cells.find((v) => `${v.x},${v.y},${v.z}` === owner)!,
    ])!;
  assert(split.faceTone!.faces[owner + ",2"]);
  assert.equal(source.faceTone!.faces[owner + ",2"], undefined);
  const a = structuredClone(s.model);
  a.canvases = [
    split,
    {
      ...structuredClone(source),
      canvasId: "second",
      cells: [{ x: 10, y: 0, z: 0, color: 0 }],
      faceTone: {
        schema: "xinghai-face-tone-1",
        faces: { "10,0,0,0": { gain: 0.51, affectPaint: false } },
      },
    },
    {
      ...structuredClone(source),
      canvasId: "third",
      cells: [{ x: 20, y: 0, z: 0, color: 0 }],
      faceTone: {
        schema: "xinghai-face-tone-1",
        faces: { "20,0,0,0": { gain: 0.61, affectPaint: false } },
      },
    },
  ];
  a.objects = [];
  const session = new CanvasSession(a);
  session.mergeCanvases(
    a.canvases.map((c) => c.canvasId),
    split.canvasId,
  );
  assert.equal(session.active.faceTone!.faces["10,0,0,0"].gain, 0.51);
  assert.equal(session.active.faceTone!.faces["20,0,0,0"].gain, 0.61);
});
test("scene join rotates tones and later untoned overlap clears the previous full surface", () => {
  const a = createAsset("a"),
    b = createAsset("b");
  a.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
  b.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
  a.faceTone = {
    schema: "xinghai-face-tone-1",
    faces: { "0,0,0,0": { gain: 0.37, affectPaint: true } },
  };
  const scene = createScene("s");
  scene.assets = [a, b].map((v) => ({
    kind: "voxel" as const,
    assetId: v.assetId,
    source: `assets/${v.assetId}.xhmodule.json`,
  }));
  scene.instances = [a, b].map((v, i) => ({
    instanceId: "i" + i,
    assetId: v.assetId,
    positionM: [i, 0, 0] as Vec3,
    rotationDeg: i === 0 ? 90 : 0,
    groupId: "base",
  }));
  const assets = new Map([
      ["a", a],
      ["b", b],
    ]),
    joined = mergeSceneInstances(
      scene,
      assets,
      ["i0", "i1"],
      "merged",
      "joined",
    );
  assert(
    Object.values(joined.asset.canvases![0].faceTone!.faces).some(
      (v) => v.gain === 0.37,
    ),
  );
  assert(
    Object.keys(joined.asset.canvases![0].faceTone!.faces).some((k) =>
      k.endsWith(",2"),
    ),
  );
  scene.instances[0].rotationDeg = 0;
  scene.instances[1].positionM = [0, 0, 0];
  assert.equal(
    Object.keys(
      mergeSceneInstances(scene, assets, ["i0", "i1"], "merged", "joined").asset
        .canvases![0].faceTone?.faces ?? {},
    ).length,
    0,
  );
});
import {
  regionalGroup,
  regionalGain,
  regionalDefaults,
} from "../core/regional-color.ts";
test("patch layouts and object identity stay stable across amplitude and mask changes", () => {
  const o = { ...regionalDefaults(), mode: "patch" as const },
    points = Array.from({ length: 80 }, (_, i) => [i * 0.03, -0.4, 0.6]),
    groups = points.map((p) => regionalGroup(p, o));
  assert(new Set(groups).size < 10);
  assert.deepEqual(
    points.map((p) => regionalGroup(p, { ...o, amount: 0.5, ratio: 0.9 })),
    groups,
  );
  assert.equal(
    regionalGroup([0, 0, 0], { ...o, mode: "objects" }, "same"),
    "object:same",
  );
  assert.throws(() => regionalGroup([0, 0, 0], { ...o, mode: "objects" }));
  const selected = groups.filter(
    (g) => regionalGain(g, { ...o, ratio: 0.2 }) !== 1,
  );
  for (const g of selected)
    assert.equal(
      regionalGain(g, { ...o, ratio: 0.2 }),
      regionalGain(g, { ...o, ratio: 0.8 }),
    );
});
