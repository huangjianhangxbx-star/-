import fs from "node:fs/promises";
import path from "node:path";
import * as core from "../dist/workshop.cjs";
export const sampleRoot = path.resolve(
  "samples/ViewportDisplay-TOOL012/project",
);
const assets = [];
for (const [id, name] of [
  ["wall", "深色岩壁与凹槽"],
  ["terrace", "层阶平台"],
  ["calibration", "六面校色与局部彩绘"],
]) {
  const a = core.createAsset(id);
  a.schema = "xinghai-workshop-asset-2";
  a.name = name;
  const cells = [];
  if (id === "wall")
    for (let x = 0; x < 24; x++)
      for (let y = 0; y < 12; y++)
        for (let z = 0; z < 20; z++) {
          const front = 2 + (Math.floor(x / 3) % 3),
            groove = x >= 9 && x <= 14 && z < 14;
          if (y >= front && !groove) cells.push({ x, y, z, color: 0 });
        }
  if (id === "terrace")
    for (let x = 0; x < 24; x++)
      for (let y = 0; y < 20; y++)
        for (
          let z = 0;
          z < 4 + Math.floor(Math.min(x, 23 - x, y, 19 - y) / 2) * 3;
          z++
        )
          cells.push({ x, y, z, color: 0 });
  a.palette.splice(0, 5, "#404040", "#808080", "#c0c0c0", "#b04868", "#38a8bc");
  if (id === "calibration")
    for (let x = 0; x < 5; x++) cells.push({ x: x * 2, y: 0, z: 0, color: x });
  a.materialProfile.colors.forEach((c, i) => {
    const hex = a.palette[i];
    c.baseColor_sRGB = [1, 3, 5].map(
      (k) => parseInt(hex.slice(k, k + 2), 16) / 255,
    );
  });
  a.canvases = [
    {
      canvasId: "body",
      name,
      visible: true,
      locked: false,
      voxelStepM: 0.25,
      originTicks: [0, 0, 0],
      cells,
      protectedColumns: [],
    },
  ];
  if (id === "calibration") {
    a.canvases[0].paintSource = {
      schema: "xinghai-surface-paint-1",
      density: 64,
      faces: {},
    };
    for (const cell of cells)
      for (let face = 0; face < 6; face++)
        a.canvases[0].paintSource.faces[`${cell.x},0,0,${face}`] = {
          0: a.palette[cell.color],
          119: "#e5b64a",
          120: "#e5b64a",
          135: "#e5b64a",
          136: "#e5b64a",
        };
    for (const [i, step] of [0.125, 0.0625].entries())
      a.canvases.push({
        canvasId: "fine" + i,
        name: "精度 " + step,
        visible: true,
        locked: false,
        voxelStepM: step,
        originTicks: [0, (i + 1) * 24, 0],
        cells: [{ x: 0, y: 0, z: 0, color: 1 }],
        protectedColumns: [],
      });
  }
  a.objects = a.canvases.map((c) => ({
    objectId: "object-" + c.canvasId,
    name: c.name,
    canvasIds: [c.canvasId],
    originTicks: c.originTicks,
    cellKeys: c.cells.map((v) => `${v.x},${v.y},${v.z}`),
  }));
  const source = `assets/${id}/asset.xhmodule.json`;
  await fs.mkdir(path.dirname(path.join(sampleRoot, source)), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(sampleRoot, source),
    JSON.stringify(core.validateAsset(a)),
  );
  assets.push({
    assetId: id,
    kind: "voxel",
    name,
    revision: 0,
    preview: null,
    source,
  });
}
const scene = {
  schema: "xinghai-workshop-scene-2",
  sceneId: "display",
  name: "视口显示技术样例",
  revision: 0,
  voxelSize: 0.25,
  groups: [{ groupId: "base", name: "BASE", visible: true }],
  decals: [],
  instances: assets.map((a, i) => ({
    instanceId: "i-" + a.assetId,
    assetId: a.assetId,
    positionM: [i * 9, 0, 0],
    rotationDeg: 0,
    groupId: "base",
  })),
};
const project = {
  schema: "xinghai-workshop-project-2",
  projectId: "display",
  name: scene.name,
  revision: 0,
  assets,
  scenes: [
    {
      sceneId: "display",
      name: scene.name,
      revision: 0,
      preview: null,
      source: "scenes/display/scene.xhscene.json",
    },
  ],
};
core.validateProjectV2(project);
core.validateSceneV2(scene);
await fs.mkdir(path.join(sampleRoot, "scenes/display"), { recursive: true });
await fs.writeFile(
  path.join(sampleRoot, "scenes/display/scene.xhscene.json"),
  JSON.stringify(scene),
);
await fs.writeFile(
  path.join(sampleRoot, "project.xhproject.json"),
  JSON.stringify(project),
);
console.log("TOOL-012 original samples: " + sampleRoot);
