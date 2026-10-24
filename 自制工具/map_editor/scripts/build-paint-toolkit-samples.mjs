import fs from "node:fs/promises";
import path from "node:path";
import * as core from "../dist/workshop.cjs";
const root = path.resolve("samples/PaintToolkit-TOOL015/project");
await fs.mkdir(root, { recursive: true });
const assets = [];
const models = [];
for (const [i, step] of [0.25, 0.125, 0.0625].entries()) {
  const a = core.createAsset("paint-toolkit-" + i);
  a.name = ["门洞练习", "平板与L角", "对称石柱"][i];
  a.cells = [];
  if (i === 0) {
    for (let x = -4; x <= 4; x++)
      for (let z = 0; z <= 6; z++) {
        if (Math.abs(x) > 1 || z >= 4) a.cells.push({ x, y: 0, z, color: 0 });
        a.cells.push({ x, y: 2, z, color: 0 });
      }
  }
  if (i === 1) {
    for (let x = -4; x <= 4; x++)
      for (let y = -2; y <= 2; y++) a.cells.push({ x, y, z: 0, color: 0 });
    for (let z = 1; z <= 4; z++)
      for (let y = -2; y <= 2; y++) a.cells.push({ x: 4, y, z, color: 0 });
  }
  if (i === 2) {
    for (const x of [-3, 3])
      for (let z = 0; z <= 7; z++)
        for (let y = 0; y < 2; y++) a.cells.push({ x, y, z, color: 0 });
  }
  const model = core.upgradeCanvases(a, "paint-toolkit-multi-" + i),
    c = model.canvases[0];
  model.name = a.name;
  c.canvasId = "practice-canvas-" + i;
  c.voxelStepM = step;
  c.originTicks = [-16, 8, 0];
  c.paintSource = { schema: "xinghai-surface-paint-1", density: 64, faces: {} };
  const p = c.cells[0];
  c.paintSource.faces[[p.x, p.y, p.z, 3].join(",")] = { 0: "#a88c65" };
  c.faceTone = {
    schema: "xinghai-face-tone-1",
    faces: {
      [[p.x, p.y, p.z, 3].join(",")]: { gain: 0.75, affectPaint: false },
    },
  };
  const keys = c.cells.map((c) => [c.x, c.y, c.z].join(","));
  model.objects = [
    {
      objectId: "practice-" + i,
      name: a.name,
      canvasIds: [c.canvasId],
      originTicks: [...c.originTicks],
      cellKeys: keys,
    },
  ];
  model.cells = [];
  core.validateAsset(model);
  const source = "assets/" + model.assetId + "/asset.xhmodule.json";
  await fs.mkdir(path.dirname(path.join(root, source)), { recursive: true });
  await fs.writeFile(path.join(root, source), JSON.stringify(model, null, 2));
  assets.push({
    assetId: model.assetId,
    kind: "voxel",
    name: a.name,
    revision: model.revision,
    source,
    preview: null,
  });
  models.push(model);
}
const s = core.createScene("paint-practice");
s.schema = "xinghai-workshop-scene-2";
s.name = "精确绘画练习";
s.instances = models.map((m, i) => ({
  instanceId: "practice-" + i,
  assetId: m.assetId,
  positionM: [i * 4, 0, 0],
  rotationDeg: 0,
  groupId: "base",
}));
delete s.assets;
await fs.mkdir(path.join(root, "scenes/paint-practice"), { recursive: true });
await fs.writeFile(
  path.join(root, "scenes/paint-practice/scene.xhscene.json"),
  JSON.stringify(s, null, 2),
);
await fs.writeFile(
  path.join(root, "project.xhproject.json"),
  JSON.stringify(
    {
      schema: "xinghai-workshop-project-2",
      projectId: "paint-practice",
      name: "精确绘画与双模式对称",
      revision: 0,
      assets,
      scenes: [
        {
          sceneId: s.sceneId,
          name: s.name,
          source: "scenes/paint-practice/scene.xhscene.json",
          revision: 0,
          preview: null,
        },
      ],
    },
    null,
    2,
  ),
);
console.log(root);
