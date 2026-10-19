import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { createAsset } from '../core/workshop-documents.ts';
import { cloneAsset } from '../core/asset-copy.ts';
import { createProject, createScene, validateProject, validateScene } from '../core/workshop-documents.ts';
import { createProjectV2, createSceneV2, validateProjectV2, validateSceneV2, checkProjectSceneReferences, assetSourcePath } from '../core/workshop-v2.ts';
import { planV1Migration } from '../core/workshop-v2-migration.ts';

const require = createRequire(import.meta.url);
const { createWorkshopV2Repository, migrateV1Copy } = require('../desktop/workshop-v2-store.cjs');
const { createWorkshopStore } = require('../desktop/workshop-store.cjs');
const core = { createAsset, validateAsset: (await import('../core/workshop-documents.ts')).validateAsset,
  validateProject, validateScene, planV1Migration, cloneAsset,
  validateProjectV2, validateSceneV2, checkProjectSceneReferences, assetSourcePath };

async function fixture(run: (root: string, repo: any) => Promise<void>) {
  await fs.mkdir('validation', { recursive: true });
  const root = await fs.mkdtemp(path.resolve('validation/workshop-v2-store-'));
  try { await run(root, createWorkshopV2Repository(core)); }
  finally { await fs.rm(root, { recursive: true, force: true }); }
}

test('v2 saves a source once and two scenes reference it; updating source preserves placements', () => fixture(async (root, repo) => {
  const opened = await repo.create(root, createProjectV2('project'));
  const asset = createAsset('stone'); asset.name = '石柱';
  const saved = await repo.saveAsset(opened.token, asset);
  assert.equal(saved.document.assets[0].source, 'assets/stone/asset.xhmodule.json');
  for (const id of ['first', 'second']) {
    const scene = createSceneV2(id); scene.name = id;
    for (let index = 0; index < 10; index++)
      scene.instances.push({ instanceId: `${id}-${index === 0 ? 'one' : index}`, assetId: 'stone',
        positionM: [index * 0.25, 0, 0], rotationDeg: 0, groupId: 'base' });
    await repo.saveScene(opened.token, scene);
  }
  const originalScene = await repo.loadScene(opened.token, 'first');
  const loadedAsset = await repo.loadAsset(opened.token, 'stone');
  loadedAsset.document.name = '新石柱'; loadedAsset.document.revision++;
  await repo.saveAsset(opened.token, loadedAsset.document);
  assert.deepEqual((await repo.loadScene(opened.token, 'first')).document.instances, originalScene.document.instances);
  const independent = await repo.makeIndependent(opened.token, 'first', 'first-one');
  assert.notEqual(independent.asset.assetId, 'stone');
  assert.equal((await repo.loadScene(opened.token, 'first')).document.instances[0].assetId, independent.asset.assetId);
  assert.equal((await repo.loadScene(opened.token, 'second')).document.instances[0].assetId, 'stone');
  assert.equal((await repo.loadScene(opened.token, 'first')).document.instances.filter((item: any) => item.assetId === 'stone').length, 9);
  assert.equal((await repo.loadScene(opened.token, 'second')).document.instances.length, 10);
  const reopened = await createWorkshopV2Repository(core).open(root);
  assert.equal((await createWorkshopV2Repository(core).open(root)).document.assets.length, 2);
  assert.equal(reopened.document.scenes.length, 2);
  assert.equal((await fs.readdir(path.join(root, 'assets'))).length, 2);
}));

test('v2 refuses missing asset references and external edits without partial writes', () => fixture(async (root, repo) => {
  const opened = await repo.create(root, createProjectV2('project'));
  const scene = createSceneV2('scene');
  scene.instances.push({ instanceId: 'one', assetId: 'missing', positionM: [0, 0, 0], rotationDeg: 0, groupId: 'base' });
  await assert.rejects(repo.saveScene(opened.token, scene), /资产/);
  assert.deepEqual((await fs.readdir(root)).filter((name) => name === 'scenes'), []);
  const asset = createAsset('stone'); await repo.saveAsset(opened.token, asset);
  const source = path.join(root, 'assets/stone/asset.xhmodule.json');
  await repo.loadAsset(opened.token, 'stone');
  await fs.appendFile(source, '\n');
  asset.revision++;
  await assert.rejects(repo.saveAsset(opened.token, asset), /外部修改/);
  assert.match(await fs.readFile(source, 'utf8'), /\n$/);
}));

test('v2 saves a new asset under a selected internal category and reopens it', () => fixture(async (root, repo) => {
  const opened = await repo.create(root, createProjectV2('project'));
  const asset = createAsset('stone'); asset.name = '石柱';
  const saved = await repo.saveAsset(opened.token, asset, null, null, '墓穴');
  assert.equal(saved.document.assets[0].source, 'assets/墓穴/stone/asset.xhmodule.json');
  assert.equal((await repo.loadAsset(opened.token, 'stone')).document.name, '石柱');
  await assert.rejects(repo.saveAsset(opened.token, createAsset('bad'), null, null, '../outside'), /分类|路径/);
  assert.equal(await fs.stat(path.join(root, 'assets/墓穴/stone/asset.xhmodule.json')).then((s) => s.isFile()), true);
}));

test('v2 browses disk folders and registered assets, including external changes', () => fixture(async (root, repo) => {
  const opened = await repo.create(root, createProjectV2('project'));
  await fs.mkdir(path.join(root, 'assets', '环境', '墓穴'), { recursive: true });
  await fs.writeFile(path.join(root, 'assets', 'notes.txt'), 'hello');
  assert.deepEqual((await repo.listAssetDirectory(opened.token, '')).map((entry: any) => entry.name), ['环境', 'notes.txt']);
  const asset = createAsset('stone'); asset.name = '石柱';
  await repo.saveAsset(opened.token, asset, null, null, '环境/墓穴');
  assert.deepEqual((await repo.listAssetDirectory(opened.token, '环境/墓穴')).map((entry: any) =>
    [entry.kind, entry.name, entry.assetId]), [['asset', '石柱', 'stone']]);
  await fs.mkdir(path.join(root, 'assets', '环境', '野外'));
  assert.deepEqual((await repo.listAssetDirectory(opened.token, '环境')).map((entry: any) => entry.name), ['墓穴', '野外']);
  await fs.rm(path.join(root, 'assets', '环境', '墓穴', 'stone', 'asset.xhmodule.json'));
  assert.equal((await repo.listAssetDirectory(opened.token, '环境/墓穴'))[0].kind, 'directory');
  await assert.rejects(repo.listAssetDirectory(opened.token, '../outside'), /路径/);
}));

test('v2 save-as project copies live sources into a new directory and keeps the old project untouched', () => fixture(async (root, repo) => {
  const oldRoot = path.join(root, 'source');
  await fs.mkdir(oldRoot);
  const opened = await repo.create(oldRoot, createProjectV2('original'));
  const asset = createAsset('stone'); asset.name = '石柱';
  await repo.saveAsset(opened.token, asset, null, null, '墓穴');
  const scene = createSceneV2('scene');
  scene.instances.push({ instanceId: 'one', assetId: 'stone', positionM: [0, 0, 0], rotationDeg: 0, groupId: 'base' });
  await repo.saveScene(opened.token, scene);
  const sourceBytes = await fs.readFile(path.join(oldRoot, 'project.xhproject.json'));
  const target = path.join(root, 'duplicate');
  const copied = await repo.copyProject(opened.token, target, '副本');
  assert.equal(copied.root, target);
  assert.deepEqual(await fs.readFile(path.join(oldRoot, 'project.xhproject.json')), sourceBytes);
  const copiedRepo = createWorkshopV2Repository(core);
  const reopened = await copiedRepo.open(target);
  assert.notEqual(reopened.document.projectId, 'original');
  assert.equal(reopened.document.name, '副本');
  assert.equal(reopened.document.assets[0].source, 'assets/墓穴/stone/asset.xhmodule.json');
  assert.equal((await copiedRepo.loadScene(reopened.token, 'scene')).document.instances[0].assetId, 'stone');
  await assert.rejects(repo.copyProject(opened.token, target, '再次复制'), /已存在|目标/);
}));

test('v2 trash protects referenced assets and restores source, placements and scene', () => fixture(async (root, repo) => {
  const opened = await repo.create(root, createProjectV2('project'));
  const asset = createAsset('stone'); await repo.saveAsset(opened.token, asset);
  const scene = createSceneV2('scene');
  scene.instances.push({ instanceId: 'one', assetId: 'stone', positionM: [0, 0, 0], rotationDeg: 0, groupId: 'base' });
  await repo.saveScene(opened.token, scene);
  const original = await fs.readFile(path.join(root, 'assets/stone/asset.xhmodule.json'));
  await assert.rejects(repo.trashAsset(opened.token, 'stone'), /1 个/);
  await repo.trashAsset(opened.token, 'stone', true);
  assert.equal((await repo.loadScene(opened.token, 'scene')).document.instances.length, 0);
  const entry = (await repo.listTrash(opened.token))[0];
  assert.equal(entry.references, 1);
  await repo.restoreTrash(opened.token, entry.trashId);
  assert.equal((await repo.loadScene(opened.token, 'scene')).document.instances.length, 1);
  assert.deepEqual(await fs.readFile(path.join(root, 'assets/stone/asset.xhmodule.json')), original);
  await repo.trashScene(opened.token, 'scene');
  assert.equal((await repo.listTrash(opened.token))[0].kind, 'scene');
  assert.equal((await createWorkshopV2Repository(core).open(root)).document.assets.length, 1);
  await repo.restoreTrash(opened.token, (await repo.listTrash(opened.token))[0].trashId);
  assert.equal((await repo.loadScene(opened.token, 'scene')).document.instances.length, 1);
}));

test('v1 conversion creates an independently readable copy and leaves original plus releases byte-identical', () => fixture(async (root) => {
  const oldRoot = path.join(root, 'old'); await fs.mkdir(oldRoot);
  const old = createWorkshopStore(oldRoot);
  const project = createProject('project'); const scene = createScene('scene'); const asset = createAsset('stone');
  asset.name = '石柱'; scene.name = '试摆';
  scene.assets.push({ kind: 'voxel', assetId: 'stone', source: 'assets/stone.xhmodule.json' });
  scene.instances.push({ instanceId: 'one', assetId: 'stone', positionM: [0, 0, 0], rotationDeg: 0, groupId: 'base' });
  project.scenes.push({ sceneId: 'scene', name: scene.name, source: 'scenes/scene/scene.xhscene.json' });
  const toBytes = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2));
  await old.commit([
    { path: 'project.xhproject.json', bytes: toBytes(project), expectedHash: null },
    { path: 'scenes/scene/scene.xhscene.json', bytes: toBytes(scene), expectedHash: null },
    { path: 'scenes/scene/assets/stone.xhmodule.json', bytes: toBytes(asset), expectedHash: null },
    { path: 'releases/frozen.bin', bytes: Buffer.from('untouched'), expectedHash: null },
  ]);
  const original = await fs.readFile(path.join(oldRoot, 'project.xhproject.json'));
  const target = path.join(root, 'converted');
  await migrateV1Copy(oldRoot, target, core);
  assert.deepEqual(await fs.readFile(path.join(oldRoot, 'project.xhproject.json')), original);
  assert.equal(await fs.readFile(path.join(oldRoot, 'releases/frozen.bin'), 'utf8'), 'untouched');
  const opened = await createWorkshopV2Repository(core).open(target);
  assert.equal(opened.document.assets.length, 1);
  assert.equal(opened.document.scenes.length, 1);
  assert.equal(await fs.stat(path.join(target, 'migration-report.json')).then((s) => s.isFile()), true);
  await assert.rejects(migrateV1Copy(oldRoot, target, core), /已存在/);
  const cancelled = path.join(root, 'cancelled');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(migrateV1Copy(oldRoot, cancelled, core, { signal: controller.signal }), /取消/);
  assert.equal(await fs.stat(cancelled).then(() => true, () => false), false);
}));
