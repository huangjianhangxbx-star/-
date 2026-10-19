import type { SceneInstance, Vec3 } from './workshop-documents.ts';

type Preview = null | { source: string; revision: number; sourceHash: string };
type AssetBase = { assetId: string; name: string; revision: number; preview: Preview;
  origin?: { libraryId: string; sourceHash: string } };
export type ProjectAssetV2 = AssetBase & (
  | { kind: 'voxel'; source: string }
  | { kind: 'texture'; image: string }
  | { kind: 'external'; model: string; files: string[]; anchorM: Vec3; recipe: 'glb-rh-y-up' | 'blender-fbx-5.1.2' }
);
export type ProjectV2 = {
  schema: 'xinghai-workshop-project-2'; projectId: string; revision: number; name: string;
  assets: ProjectAssetV2[];
  scenes: { sceneId: string; name: string; revision: number; source: string; preview: Preview }[];
};
export type SceneV2 = {
  schema: 'xinghai-workshop-scene-2'; sceneId: string; revision: number; name: string; voxelSize: 0.25;
  instances: SceneInstance[];
  groups: { groupId: string; name: string; visible: boolean }[];
  decals: { decalId: string; assetId: string; positionM: Vec3; rotationDeg: number; widthM: number; heightM: number }[];
};
function object(value: unknown, label: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`${label}必须是对象`);
  return value as Record<string, any>;
}
function only(value: Record<string, any>, keys: string[], label: string) {
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw Error(`${label}不支持字段 ${key}`);
  for (const key of keys) if (!(key in value)) throw Error(`${label}缺少字段 ${key}`);
}
function id(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw Error(`${label}身份无效`);
}
function name(value: unknown, label: string) {
  if (typeof value !== 'string' || value.length > 200) throw Error(`${label}名称无效`);
}
function revision(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 2147483647) throw Error(`${label}修订号无效`);
}
function list(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length > 10000) throw Error(`${label}列表无效`);
  return value;
}
function unique(ids: Set<string>, value: string, label: string) {
  if (ids.has(value)) throw Error(`${label}身份重复：${value}`);
  ids.add(value);
}
function path(value: unknown, expected: string, label: string) {
  if (value !== expected) throw Error(`${label}路径必须是 ${expected}`);
}
export function assetSourcePath(assetId: string, folder = ''): string {
  id(assetId, '资产');
  const segments = folder ? folder.split('/') : [];
  if (segments.length > 8 || segments.some((part) =>
    !part || part.length > 80 || /[\\/:*?"<>|\x00-\x1f]/.test(part) ||
    /[. ]$/.test(part) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part)))
    throw Error('项目内分类文件夹路径无效');
  return `assets/${folder ? `${folder}/` : ''}${assetId}/asset.xhmodule.json`;
}
function voxelSource(value: unknown, assetId: string) {
  if (typeof value !== 'string') throw Error('体素资产路径无效');
  const parts = value.split('/');
  if (parts.length < 3 || parts.length > 11) throw Error('体素资产路径无效');
  path(value, assetSourcePath(assetId, parts.slice(1, -2).join('/')), '体素资产');
}
function assetFile(value: unknown, assetId: string, label: string) {
  if (typeof value !== 'string' || !value.startsWith(`assets/${assetId}/`) ||
      value.length > 1024 || /[\\:\x00-\x1f<>"|?*]/.test(value) ||
      value.split('/').some((part) => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part)))
    throw Error(`${label}路径无效`);
}
function preview(value: unknown, expected: string, currentRevision: number) {
  if (value === null) return;
  const row = object(value, '预览');
  only(row, ['source', 'revision', 'sourceHash'], '预览');
  path(row.source, expected, '预览');
  revision(row.revision, '预览');
  if (row.revision !== currentRevision || typeof row.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(row.sourceHash))
    throw Error('预览修订或源哈希无效');
}
function vector(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((n) => !Number.isFinite(n) || Math.abs(n) > 2048))
    throw Error(`${label}坐标无效`);
}
function angle(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) % 90 !== 0 || Math.abs(value as number) > 360000)
    throw Error('旋转无效');
}
export function createProjectV2(projectId: string): ProjectV2 {
  return validateProjectV2({ schema: 'xinghai-workshop-project-2', projectId, revision: 0, name: '', assets: [], scenes: [] });
}
export function createSceneV2(sceneId: string): SceneV2 {
  return validateSceneV2({ schema: 'xinghai-workshop-scene-2', sceneId, revision: 0, name: '', voxelSize: 0.25, instances: [], decals: [],
    groups: [
      { groupId: 'base', name: 'BASE', visible: true },
      { groupId: 'platform', name: 'PLATFORM', visible: true },
      { groupId: 'large-env', name: 'LARGE ENV', visible: true },
      { groupId: 'small-env', name: 'SMALL ENV', visible: true },
    ] });
}
export function validateProjectV2(input: unknown): ProjectV2 {
  const project = object(input, '项目');
  only(project, ['schema', 'projectId', 'revision', 'name', 'assets', 'scenes'], '项目');
  if (project.schema !== 'xinghai-workshop-project-2') throw Error('项目格式无效');
  id(project.projectId, '项目'); revision(project.revision, '项目'); name(project.name, '项目');
  const assetIds = new Set<string>(), sceneIds = new Set<string>(), files = new Set<string>();
  for (const value of list(project.assets, '项目资产')) {
    const asset = object(value, '项目资产');
    const common = ['kind', 'assetId', 'name', 'revision', 'preview'];
    if (asset.kind === 'voxel') {
      only(asset, [...common, 'source', ...(asset.origin === undefined ? [] : ['origin'])], '体素资产');
      voxelSource(asset.source, asset.assetId);
      unique(files, asset.source, '源文件');
    } else if (asset.kind === 'texture') {
      only(asset, [...common, 'image'], '图片资产');
      path(asset.image, `assets/${asset.assetId}/image.png`, '图片资产');
      unique(files, asset.image, '源文件');
    } else if (asset.kind === 'external') {
      only(asset, [...common, 'model', 'files', 'anchorM', 'recipe'], '外部资产');
      path(asset.model, `assets/${asset.assetId}/model.glb`, '外部模型');
      vector(asset.anchorM, '外部Root');
      if (!['glb-rh-y-up', 'blender-fbx-5.1.2'].includes(asset.recipe)) throw Error('外部配方无效');
      const dependencies = list(asset.files, '外部依赖');
      if (!dependencies.includes(asset.model)) throw Error('外部依赖缺模型');
      for (const file of dependencies) { assetFile(file, asset.assetId, '外部依赖'); unique(files, file, '源文件'); }
    } else throw Error('项目资产类型无效');
    id(asset.assetId, '资产'); unique(assetIds, asset.assetId, '资产');
    if (asset.origin !== undefined) {
      const origin = object(asset.origin, '公共库来源');
      only(origin, ['libraryId', 'sourceHash'], '公共库来源');
      id(origin.libraryId, '公共库来源');
      if (typeof origin.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(origin.sourceHash))
        throw Error('公共库来源哈希无效');
    }
    name(asset.name, '资产'); revision(asset.revision, '资产');
    preview(asset.preview, asset.kind === 'voxel'
      ? asset.source.replace(/asset\.xhmodule\.json$/, 'preview.png')
      : `assets/${asset.assetId}/preview.png`, asset.revision);
    if (asset.preview) unique(files, asset.preview.source, '预览文件');
  }
  for (const value of list(project.scenes, '场景')) {
    const scene = object(value, '场景入口');
    only(scene, ['sceneId', 'name', 'revision', 'source', 'preview'], '场景入口');
    id(scene.sceneId, '场景入口'); unique(sceneIds, scene.sceneId, '场景');
    name(scene.name, '场景'); revision(scene.revision, '场景');
    path(scene.source, `scenes/${scene.sceneId}/scene.xhscene.json`, '场景入口');
    preview(scene.preview, `scenes/${scene.sceneId}/preview.png`, scene.revision);
    unique(files, scene.source, '源文件');
    if (scene.preview) unique(files, scene.preview.source, '预览文件');
  }
  return structuredClone(project) as ProjectV2;
}
export function validateSceneV2(input: unknown): SceneV2 {
  const scene = object(input, '场景');
  only(scene, ['schema', 'sceneId', 'revision', 'name', 'voxelSize', 'instances', 'groups', 'decals'], '场景');
  if (scene.schema !== 'xinghai-workshop-scene-2' || scene.voxelSize !== 0.25) throw Error('场景格式或体素规格无效');
  id(scene.sceneId, '场景'); revision(scene.revision, '场景'); name(scene.name, '场景');
  const groups = new Set<string>(), entities = new Set<string>();
  for (const value of list(scene.groups, '分组')) {
    const group = object(value, '分组'); only(group, ['groupId', 'name', 'visible'], '分组');
    id(group.groupId, '分组'); unique(groups, group.groupId, '分组'); name(group.name, '分组');
    if (typeof group.visible !== 'boolean') throw Error('分组显隐无效');
  }
  for (const value of list(scene.instances, '实例')) {
    const instance = object(value, '实例');
    only(instance, ['instanceId', 'assetId', 'positionM', 'rotationDeg', 'groupId'], '实例');
    id(instance.instanceId, '实例'); unique(entities, instance.instanceId, '实例');
    id(instance.assetId, '实例资产'); vector(instance.positionM, '实例位置'); angle(instance.rotationDeg);
    if (!groups.has(instance.groupId)) throw Error('实例分组不存在');
  }
  for (const value of list(scene.decals, '贴花')) {
    const decal = object(value, '贴花');
    only(decal, ['decalId', 'assetId', 'positionM', 'rotationDeg', 'widthM', 'heightM'], '贴花');
    id(decal.decalId, '贴花'); unique(entities, decal.decalId, '实例/贴花');
    id(decal.assetId, '贴花资产'); vector(decal.positionM, '贴花位置'); angle(decal.rotationDeg);
    if ([decal.widthM, decal.heightM].some((n) => !Number.isFinite(n) || n <= 0 || n > 256)) throw Error('贴花尺寸无效');
  }
  return structuredClone(scene) as SceneV2;
}
export function checkProjectSceneReferences(projectInput: unknown, sceneInputs: unknown[]): string[] {
  const project = validateProjectV2(projectInput);
  const assets = new Map(project.assets.map((asset) => [asset.assetId, asset]));
  const scenes = new Map(sceneInputs.map((input) => { const scene = validateSceneV2(input); return [scene.sceneId, scene]; }));
  const issues: string[] = [];
  for (const row of project.scenes) {
    const scene = scenes.get(row.sceneId);
    if (!scene) { issues.push(`${row.sceneId}: missing scene`); continue; }
    if (scene.name !== row.name || scene.revision !== row.revision) issues.push(`${row.sceneId}: scene summary mismatch`);
    for (const instance of scene.instances) {
      const asset = assets.get(instance.assetId);
      if (!asset || asset.kind === 'texture') issues.push(`${row.sceneId}/${instance.instanceId}: missing model asset ${instance.assetId}`);
    }
    for (const decal of scene.decals) {
      const asset = assets.get(decal.assetId);
      if (!asset || asset.kind !== 'texture') issues.push(`${row.sceneId}/${decal.decalId}: missing texture asset ${decal.assetId}`);
    }
  }
  for (const sceneId of scenes.keys()) if (!project.scenes.some((row) => row.sceneId === sceneId)) issues.push(`${sceneId}: unregistered scene`);
  return issues;
}
