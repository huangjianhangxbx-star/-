import { cloneAsset } from './asset-copy.ts';
import {
  validateAsset, validateProject, validateScene,
  type AssetDocument, type ProjectDocument, type SceneDocument,
} from './workshop-documents.ts';
import { checkProjectSceneReferences, validateProjectV2, validateSceneV2,
  type ProjectV2, type SceneV2 } from './workshop-v2.ts';

type MigrationMapping = {
  sceneId: string; oldAssetId: string; newAssetId: string; kind: string;
  oldSource: string; newSource: string;
};
/** A pure plan. The caller reads every source and writes only to a new staging directory. */
export function planV1Migration(
  projectInput: ProjectDocument,
  sceneInputs: SceneDocument[],
  voxelSources: ReadonlyMap<string, AssetDocument>,
  nextId: () => string,
  binarySources: ReadonlyMap<string, Uint8Array> = new Map(),
): {
  project: ProjectV2; scenes: SceneV2[];
  assets: { path: string; document: AssetDocument }[];
  binaries: { path: string; bytes: Uint8Array }[];
  report: { sourceSchema: string; targetSchema: string; mappings: MigrationMapping[] };
} {
  const original = validateProject(projectInput);
  const scenes = sceneInputs.map(validateScene);
  if (scenes.length !== original.scenes.length ||
      scenes.some((scene, index) => scene.sceneId !== original.scenes[index].sceneId || scene.name !== original.scenes[index].name))
    throw Error('迁移场景登记与源内容不一致');
  const project = validateProjectV2({
    schema: 'xinghai-workshop-project-2', projectId: original.projectId,
    revision: original.revision + 1, name: original.name, assets: [], scenes: [],
  });
  const assets: { path: string; document: AssetDocument }[] = [];
  const binaries: { path: string; bytes: Uint8Array }[] = [];
  const mappings: MigrationMapping[] = [];
  const used = new Set<string>();
  const migratedScenes: SceneV2[] = [];
  for (const scene of scenes) {
    const ids = new Map<string, string>();
    for (const row of scene.assets) {
      const newId = nextId();
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(newId) || used.has(newId)) throw Error('迁移资产身份冲突');
      used.add(newId);
      ids.set(row.assetId, newId);
      const prefix = `assets/${newId}`;
      let oldSource = '', newSource = '';
      if (row.kind === 'voxel') {
        const source = voxelSources.get(`${scene.sceneId}/${row.assetId}`);
        if (!source) throw Error(`缺少模块源 ${scene.sceneId}/${row.assetId}`);
        const validated = validateAsset(source);
        if (validated.assetId !== row.assetId) throw Error('迁移源模块身份不符');
        const document = cloneAsset(validated, newId);
        document.revision = validated.revision;
        newSource = `${prefix}/asset.xhmodule.json`;
        oldSource = `scenes/${scene.sceneId}/${row.source}`;
        project.assets.push({ kind: 'voxel', assetId: newId, name: document.name,
          revision: document.revision, source: newSource, preview: null });
        assets.push({ path: newSource, document });
      } else if (row.kind === 'texture') {
        oldSource = `scenes/${scene.sceneId}/${row.image}`;
        newSource = `${prefix}/image.png`;
        const bytes = binarySources.get(oldSource);
        if (!bytes) throw Error(`缺少图片源 ${oldSource}`);
        project.assets.push({ kind: 'texture', assetId: newId, name: row.assetId,
          revision: row.revision, image: newSource, preview: null });
        binaries.push({ path: newSource, bytes });
      } else {
        oldSource = `scenes/${scene.sceneId}/${row.model}`;
        newSource = `${prefix}/model.glb`;
        const files = row.files.map((file) => {
          const oldPath = `scenes/${scene.sceneId}/${file}`;
          const bytes = binarySources.get(oldPath);
          if (!bytes) throw Error(`缺少外部源 ${oldPath}`);
          const newPath = `${prefix}/${file.split('/').slice(2).join('/')}`;
          binaries.push({ path: newPath, bytes });
          return newPath;
        });
        project.assets.push({ kind: 'external', assetId: newId, name: row.assetId,
          revision: row.revision, model: newSource, files,
          anchorM: row.anchorM, recipe: row.recipe, preview: null });
      }
      mappings.push({ sceneId: scene.sceneId, oldAssetId: row.assetId, newAssetId: newId,
        kind: row.kind, oldSource, newSource });
    }
    const mapId = (oldId: string) => {
      const id = ids.get(oldId);
      if (!id) throw Error(`场景 ${scene.sceneId} 引用缺少资产 ${oldId}`);
      return id;
    };
    const converted = validateSceneV2({
      schema: 'xinghai-workshop-scene-2', sceneId: scene.sceneId,
      revision: scene.revision, name: scene.name, voxelSize: 0.25,
      groups: scene.groups,
      instances: scene.instances.map((item) => ({ ...item, assetId: mapId(item.assetId) })),
      decals: scene.decals.map((item) => ({ ...item, assetId: mapId(item.assetId) })),
    });
    migratedScenes.push(converted);
    project.scenes.push({ sceneId: converted.sceneId, name: converted.name,
      revision: converted.revision, source: `scenes/${converted.sceneId}/scene.xhscene.json`, preview: null });
  }
  validateProjectV2(project);
  const issues = checkProjectSceneReferences(project, migratedScenes);
  if (issues.length) throw Error(`迁移引用验证失败：${issues.join('; ')}`);
  return { project, scenes: migratedScenes, assets, binaries,
    report: { sourceSchema: original.schema, targetSchema: project.schema, mappings } };
}
