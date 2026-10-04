import assert from "node:assert/strict";
import { paletteFromMap } from "../core/palette.ts";
import { createReference } from "../core/references.ts";

// Missing planned modules fail an assertion; dependency/import errors still escape.
export async function plannedModule(name: string): Promise<any> {
  const url = new URL(`../core/${name}.ts`, import.meta.url);
  try {
    return await import(url.href);
  } catch (error) {
    if (error.code === "ERR_MODULE_NOT_FOUND" && error.url === url.href)
      return {};
    throw error;
  }
}
export function fn(module: any, name: string): any {
  assert.equal(typeof module[name], "function", `Task1 must implement ${name}`);
  return module[name];
}
export const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
export function asset() {
  const palette = ["#59737a", "#cc8f38"];
  return {
    schema: "xinghai-workshop-asset-1",
    assetId: "library-a",
    revision: 0,
    name: "",
    voxelSize: 0.25,
    cells: [{ x: -1, y: 2, z: 0, color: 0, owner: "volume" }],
    palette,
    materialProfile: paletteFromMap({
      mapId: "library-a",
      revision: 0,
      voxelSize: 0.25,
      palette,
    }),
    protectedColumns: ["-1,2"],
    anchorM: [0, 0, 0],
    rootMode: "grid",
    editor: {
      reference: createReference({
        id: "ref-a",
        name: "人物",
        dataUrl: png,
        pixelWidth: 1,
        pixelHeight: 1,
      }),
    },
  };
}
export function scene() {
  return {
    schema: "xinghai-workshop-scene-1",
    sceneId: "scene-a",
    revision: 0,
    name: "墓室",
    voxelSize: 0.25,
    assets: [
      {
        kind: "voxel",
        assetId: "library-a",
        source: "assets/library-a.xhmodule.json",
      },
    ],
    instances: [
      {
        instanceId: "i-a",
        assetId: "library-a",
        positionM: [0.25, -0.5, 2],
        rotationDeg: 90,
        groupId: "base",
      },
    ],
    groups: [{ groupId: "base", name: "BASE", visible: true }],
    decals: [],
  };
}
