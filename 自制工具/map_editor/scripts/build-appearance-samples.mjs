import fs from "node:fs/promises";
import path from "node:path";
import * as core from "../dist/workshop.cjs";
export const sampleRoot = path.resolve(
  "samples/RegionalAppearance-TOOL013/project",
);
await fs.mkdir(sampleRoot, { recursive: true });
const assets = [],
  recipes = [];
for (const [shape, name, hex] of [
  ["wall", "拱洞砌块练习墙", "#404040"],
  ["terrace", "层阶练习平台", "#808080"],
]) {
  const base = core.createAsset(shape);
  base.schema = "xinghai-workshop-asset-2";
  base.name = name;
  base.anchorM = [0.125, 0, 0.25];
  base.rootMode = "free";
  base.palette[0] = hex;
  base.materialProfile.colors[0].baseColor_sRGB = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const cells = [];
  for (let x = 0; x < 24; x++)
    for (let y = 0; y < (shape === "wall" ? 5 : 16); y++)
      for (
        let z = 0;
        z <
        (shape === "wall"
          ? 18
          : 3 + Math.floor(Math.min(x, 23 - x, y, 15 - y) / 2) * 2);
        z++
      ) {
        if (shape === "wall" && x >= 8 && x < 16 && z < 10) continue;
        cells.push({ x, y, z, color: 0 });
      }
  base.cells = [];
  base.canvases = [
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
  const owner = new Map();
  for (const cell of cells) {
    const group = core.regionalGroup(
      [cell.x, cell.y, cell.z].map((v) => (v + 0.5) * 0.25),
      core.regionalDefaults(),
    );
    if (!owner.has(group)) owner.set(group, []);
    owner.get(group).push(`${cell.x},${cell.y},${cell.z}`);
  }
  base.objects = [...owner].map(([group, keys], i) => ({
    objectId: "brick-" + i,
    name: "作者块 " + i,
    canvasIds: ["body"],
    cellKeys: keys,
    originTicks: [0, 0, 0],
  }));
  const keys = new Set(cells.map((c) => `${c.x},${c.y},${c.z}`));
  for (const variant of [
    "pure",
    "noise",
    "region-17",
    "region-73",
    "region-211",
    "tone",
    "combined",
  ]) {
    let a = structuredClone(base);
    const seed = Number(variant.split("-")[1]) || 17;
    if (variant === "noise") {
      for (let i = 0; i < 5; i++) {
        const color = core.appearanceColor(hex, undefined, {
          gain: 1 + (i - 2) * 0.09,
          affectPaint: false,
        });
        a.palette.push(color);
        const material = structuredClone(a.materialProfile.colors[0]);
        material.colorId = "oldnoise-" + i;
        material.baseColor_sRGB = [1, 3, 5].map(
          (j) => parseInt(color.slice(j, j + 2), 16) / 255,
        );
        a.materialProfile.colors.push(material);
      }
      for (const c of a.canvases[0].cells)
        c.color =
          base.palette.length +
          Math.min(
            4,
            Math.floor(core.stableHash(`${c.x},${c.y},${c.z}:17`) * 5),
          );
    }
    if (variant.startsWith("region") || variant === "combined")
      a = core.planAppearance(a, "body", keys, {
        kind: "region",
        regional: {
          ...core.regionalDefaults(),
          mode: shape === "wall" ? "brick" : "patch",
          seed,
        },
      }).nextModel;
    if (variant === "tone" || variant === "combined")
      a = core.planAppearance(a, "body", keys, {
        kind: "tone",
        preset: "up-down",
        strength: 0.32,
        light: [1, -1, 2],
        bands: 3,
        affectPaint: false,
      }).nextModel;
    const id = shape + "-" + variant;
    a.assetId = id;
    a.name = name + " · " + variant;
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
      name: a.name,
      revision: 0,
      preview: null,
      source,
    });
    recipes.push({
      assetId: id,
      variant,
      regional: core.regionalDefaults(),
      seed,
      base: hex,
      step: 0.25,
      scope: "body所有显式成员",
      tone: variant === "tone" || variant === "combined" ? 0.32 : 0,
    });
  }
}
const scene = {
  schema: "xinghai-workshop-scene-2",
  sceneId: "appearance",
  name: "区域色差与美术暗面 SAMPLE",
  revision: 0,
  voxelSize: 0.25,
  groups: [{ groupId: "base", name: "BASE", visible: true }],
  decals: [],
  instances: assets.map((a, i) => ({
    instanceId: "i-" + a.assetId,
    assetId: a.assetId,
    positionM: [(i % 7) * 8, Math.floor(i / 7) * 9, 0],
    rotationDeg: 0,
    groupId: "base",
  })),
};
const project = {
  schema: "xinghai-workshop-project-2",
  projectId: "appearance",
  name: scene.name,
  voxelSize: 0.25,
  assets,
  scenes: [
    {
      sceneId: "appearance",
      name: scene.name,
      source: "scenes/appearance/scene.xhscene.json",
    },
  ],
  activeSceneId: "appearance",
};
// Match the versioned project descriptor used by the existing sample builder.
const template = JSON.parse(
  await fs.readFile(
    "samples/ViewportDisplay-TOOL012/project/project.xhproject.json",
    "utf8",
  ),
);
const descriptor = {
  ...template,
  projectId: project.projectId,
  name: project.name,
  assets,
  scenes: project.scenes.map((c) => ({ ...c, revision: 0, preview: null })),
};
await fs.mkdir(path.join(sampleRoot, "scenes/appearance"), { recursive: true });
await fs.writeFile(
  path.join(sampleRoot, "project.xhproject.json"),
  JSON.stringify(core.validateProjectV2(descriptor)),
);
await fs.writeFile(
  path.join(sampleRoot, "scenes/appearance/scene.xhscene.json"),
  JSON.stringify(core.validateSceneV2(scene)),
);
await fs.writeFile(
  path.resolve("samples/RegionalAppearance-TOOL013/recipes.json"),
  JSON.stringify(recipes, null, 2),
);
await fs.writeFile(
  path.resolve("samples/RegionalAppearance-TOOL013/README.md"),
  "# TOOL-013 原创练习样例\n\n打开 project 文件夹。每排依次为纯色、逐格噪点对照、区域种子 17 / 73 / 211、暗面、组合。全部为程序生成的原创体素；参数仅为 SAMPLE，等待用户美术验收。\n\n顶部“上色”选择分组与幅度；编辑模式先选体素，物体模式先选同画布物体。以“编辑显示→材质原色”检查作者颜色。",
);
console.log(sampleRoot);
