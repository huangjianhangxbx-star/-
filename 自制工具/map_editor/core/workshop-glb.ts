import { exportNativeAssetGlb } from "./glb.ts";
import { assembleStaticSceneGlb } from "./scene-glb.ts";
import { toNativeV1 } from "./workshop-adapter.ts";
import { validatePublishGlb } from "./publish-glb-validation.ts";
import {
  validateAsset,
  validateScene,
  checkSceneReferences,
  type AssetDocument,
  type SceneDocument,
  type SceneAssets,
} from "./workshop-documents.ts";
export function exportAssetGlb(input: AssetDocument): Uint8Array {
  const asset = validateAsset(input);
  if (!asset.cells.length) throw Error("空模块不能导出GLB");
  return exportNativeAssetGlb(toNativeV1(asset));
}
export function exportWorkshopSceneGlb(
  input: SceneDocument,
  assets: SceneAssets,
): Uint8Array {
  const scene = validateScene(input),
    issues = checkSceneReferences(scene, assets);
  if (issues.length) throw Error(issues.map((i) => i.message).join("\n"));
  const binaries = new Map<string, Uint8Array>();
  for (const row of scene.assets) {
    const a = assets.get(row.assetId)!;
    if (a.kind === "external") validatePublishGlb(a.glb);
    binaries.set(
      row.assetId,
      a.kind === "voxel"
        ? exportAssetGlb(a.document)
        : a.kind === "texture"
          ? a.png
          : a.glb,
    );
  }
  const instances = scene.instances.map((p) => {
    const a = assets.get(p.assetId)!;
    return {
      id: p.instanceId,
      assetId: p.assetId,
      x: p.positionM[0],
      y: p.positionM[1],
      z: p.positionM[2],
      rotation: p.rotationDeg,
      anchor: a.kind === "external" ? a.anchorM : [0, 0, 0],
      groupId: p.groupId,
    };
  });
  const decals = scene.decals.map((p) => ({
    id: p.decalId,
    assetId: p.assetId,
    x: p.positionM[0],
    y: p.positionM[1],
    z: p.positionM[2],
    rotation: p.rotationDeg,
    width: p.widthM,
    height: p.heightM,
  }));
  return assembleStaticSceneGlb(
    {
      mapId: scene.sceneId,
      sceneId: scene.sceneId,
      revision: scene.revision,
      cells: [],
      instances,
      decals,
    },
    binaries,
  );
}
