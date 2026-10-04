import { validateMap } from "./document.ts";
import { paletteFromMap } from "./palette.ts";
import { cloneAsset } from "./asset-copy.ts";
import { transformPoint } from "./coordinates.ts";
import {
  createAsset,
  createScene,
  validateAsset,
  validateScene,
  checkSceneReferences,
  type SceneDocument,
  type SceneAssets,
  type AssetDocument,
  type SceneAsset,
  type Vec3,
  type Issue,
} from "./workshop-documents.ts";
export type IdSource = () => string;
export type MigrationResult = {
  scene: SceneDocument;
  modules: AssetDocument[];
  copiedFiles: { path: string; bytes: Uint8Array }[];
  legacyJson: string;
  issues: Issue[];
  report: {
    schema: "xinghai-workshop-migration-1";
    sceneId: string;
    mappings: { oldId: string; newId: string }[];
    compensations: {
      oldId: string;
      newId: string;
      before: Vec3;
      after: Vec3;
    }[];
    notes: string[];
    issues: Issue[];
  };
};
function result(scene: SceneDocument, legacyJson: string): MigrationResult {
  return {
    scene,
    modules: [],
    copiedFiles: [],
    legacyJson,
    issues: [],
    report: {
      schema: "xinghai-workshop-migration-1",
      sceneId: scene.sceneId,
      mappings: [],
      compensations: [],
      notes: [],
      issues: [],
    },
  };
}
function copySource(
  out: MigrationResult,
  oldId: string,
  assets: SceneAssets,
  next: IdSource,
  fallback: "external" | "texture" | "voxel",
  mapped: Map<string, SceneAsset>,
  resolved: Map<string, any>,
): SceneAsset {
  const prior = mapped.get(oldId);
  if (prior) {
    if ((prior.kind === "texture") !== (fallback === "texture"))
      throw Error("同一旧资产被用于不兼容的模型和贴花");
    return prior;
  }
  const source = assets.get(oldId),
    id = next();
  let row: SceneAsset;
  if (source?.kind === "voxel") {
    if (fallback === "texture") throw Error("体素模块不能作为PNG贴花");
    const document = cloneAsset(source.document, id);
    out.modules.push(document);
    row = { kind: "voxel", assetId: id, source: `assets/${id}.xhmodule.json` };
    resolved.set(id, { kind: "voxel", document });
  } else if (source?.kind === "texture") {
    if (fallback !== "texture") throw Error("PNG不能作为模型实例");
    row = {
      kind: "texture",
      assetId: id,
      revision: source.revision,
      image: `textures/${id}.png`,
    };
    out.copiedFiles.push({ path: row.image, bytes: source.png.slice() });
    resolved.set(id, { ...source, png: source.png.slice() });
  } else {
    if (source && fallback === "texture") throw Error("模型不能作为PNG贴花");
    if (fallback === "texture")
      row = {
        kind: "texture",
        assetId: id,
        revision: 0,
        image: `textures/${id}.png`,
      };
    else if (!source && fallback === "voxel")
      row = {
        kind: "voxel",
        assetId: id,
        source: `assets/${id}.xhmodule.json`,
      };
    else {
      const model = `external/${id}/model.glb`,
        files =
          source?.kind === "external"
            ? source.files.map((f) => ({
                path: `external/${id}/dependencies/${f.path}`,
                bytes: f.bytes.slice(),
                sha256: f.sha256,
              }))
            : [];
      row = {
        kind: "external",
        assetId: id,
        revision: source?.kind === "external" ? source.revision : 0,
        model,
        files: [model, ...files.map((f) => f.path)],
        anchorM: source?.kind === "external" ? [...source.anchorM] : [0, 0, 0],
        recipe: source?.kind === "external" ? source.recipe : "glb-rh-y-up",
      };
      if (source?.kind === "external") {
        out.copiedFiles.push(
          { path: model, bytes: source.glb.slice() },
          ...files,
        );
        resolved.set(id, {
          ...source,
          anchorM: [...source.anchorM],
          glb: source.glb.slice(),
          files: [
            { path: model, bytes: source.glb.slice(), sha256: "" },
            ...files,
          ],
        });
      }
    }
  }
  mapped.set(oldId, row);
  out.scene.assets.push(row);
  out.report.mappings.push({ oldId, newId: id });
  return row;
}
export function migrateLegacy(
  json: string,
  assets: SceneAssets,
  next: IdSource,
): MigrationResult {
  const old = validateMap(JSON.parse(json)),
    scene = createScene(next()),
    out = result(scene, json),
    mapped = new Map<string, SceneAsset>(),
    resolved = new Map<string, any>();
  scene.name =
    typeof old.name === "string" ? old.name.slice(0, 200) : `旧图 ${old.mapId}`;
  const terrain = createAsset(next());
  terrain.name = "旧图地形";
  terrain.cells = old.cells;
  terrain.palette = old.palette;
  terrain.protectedColumns = old.protectedColumns;
  terrain.materialProfile = paletteFromMap(old);
  if (old.sideColor !== undefined) terrain.sideColor = old.sideColor;
  if (old.editor !== undefined) terrain.editor = old.editor;
  const copied = cloneAsset(validateAsset(terrain), next());
  out.modules.push(copied);
  scene.assets.push({
    kind: "voxel",
    assetId: copied.assetId,
    source: `assets/${copied.assetId}.xhmodule.json`,
  });
  resolved.set(copied.assetId, { kind: "voxel", document: copied });
  out.report.mappings.push({ oldId: old.mapId, newId: copied.assetId });
  scene.instances.push({
    instanceId: next(),
    assetId: copied.assetId,
    positionM: [0, 0, 0],
    rotationDeg: 0,
    groupId: "base",
  });
  for (const p of old.instances) {
    const row = copySource(
        out,
        p.assetId,
        assets,
        next,
        "external",
        mapped,
        resolved,
      ),
      before: Vec3 = [p.x, p.y, p.z],
      anchor: Vec3 = p.anchor ?? [0, 0, 0];
    // Native GLB already subtracts its source Root; its legacy instance anchor is additional.
    const root: Vec3 = row.kind === "external" ? row.anchorM : [0, 0, 0],
      position = transformPoint(root, anchor, before, p.rotation),
      id = next();
    scene.instances.push({
      instanceId: id,
      assetId: row.assetId,
      positionM: position,
      rotationDeg: p.rotation,
      groupId: p.kind === "event" ? "small-env" : "large-env",
    });
    out.report.compensations.push({
      oldId: p.id,
      newId: id,
      before,
      after: position,
    });
  }
  for (const d of old.decals) {
    const row = copySource(
      out,
      d.assetId,
      assets,
      next,
      "texture",
      mapped,
      resolved,
    );
    scene.decals.push({
      decalId: next(),
      assetId: row.assetId,
      positionM: [d.x, d.y, d.z],
      rotationDeg: d.rotation,
      widthM: d.width,
      heightM: d.height,
    });
  }
  out.scene = validateScene(scene);
  out.issues = checkSceneReferences(out.scene, resolved);
  out.report.issues = out.issues;
  out.report.notes.push(
    "原始JSON完整保留；surface、事件registryKey与未知字段仅在附件中，不代表玩法已迁入。",
    "实例位置已按旧锚点补偿；不重排源体素，不执行旧地形支撑清理。",
  );
  return out;
}
export function copyWorkshopScene(
  input: SceneDocument,
  assets: SceneAssets,
  next: IdSource,
): MigrationResult {
  const old = validateScene(input),
    scene = createScene(next()),
    out = result(scene, ""),
    mapped = new Map<string, SceneAsset>(),
    resolved = new Map<string, any>();
  scene.name = `${old.name} 副本`.slice(0, 200);
  scene.groups = structuredClone(old.groups);
  for (const row of old.assets)
    copySource(out, row.assetId, assets, next, row.kind, mapped, resolved);
  scene.instances = old.instances.map((p) => ({
    ...structuredClone(p),
    instanceId: next(),
    assetId: mapped.get(p.assetId)!.assetId,
  }));
  scene.decals = old.decals.map((p) => ({
    ...structuredClone(p),
    decalId: next(),
    assetId: mapped.get(p.assetId)!.assetId,
  }));
  out.scene = validateScene(scene);
  out.issues = checkSceneReferences(scene, resolved);
  out.report.issues = out.issues;
  out.report.notes.push(
    "场景与本地源/实例全部重新生成身份；变换和世界几何保持。",
  );
  return out;
}
