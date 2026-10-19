const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createWorkshopStore } = require('./workshop-store.cjs');
const { digest } = require('./files.cjs');
const { validatePngIntegrity } = require('./workshop-ipc.cjs');

const PROJECT = 'project.xhproject.json';
const TRASH = '.workshop-trash/index.json';
const bytes = (value) => Buffer.from(JSON.stringify(value, null, 2));
const parse = (loaded) => JSON.parse(Buffer.from(loaded.bytes).toString('utf8'));
const assetPath = (id, folder = '') => `assets/${folder ? `${folder}/` : ''}${id}/asset.xhmodule.json`;
const scenePath = (id) => `scenes/${id}/scene.xhscene.json`;

/** V2 is deliberately separate from the v1 bridge: it never rewrites a legacy project. */
function createWorkshopV2Repository(core) {
  let session = null;
  function current(token) {
    if (!session || session.token !== token) throw Error('项目会话已失效');
    return session;
  }
  async function attach(root, store) {
    const loaded = await store.load(PROJECT);
    const document = core.validateProjectV2(parse(loaded));
    session = { token: crypto.randomUUID(), root, store, document, projectHash: loaded.hash, leases: new Map() };
    return { token: session.token, document, name: document.name, root, version: 2 };
  }
  async function projectOnDisk(s) {
    const loaded = await s.store.load(PROJECT);
    if (loaded.hash !== s.projectHash) throw Error('项目已被外部修改，请重新打开');
    return loaded;
  }
  async function loadRegistered(s, file, id, kind) {
    const row = (kind === 'asset' ? s.document.assets : s.document.scenes)
      .find((item) => item[`${kind}Id`] === id);
    if (!row || (kind === 'asset' ? row.source : row.source) !== file) throw Error('源未在项目登记');
    const loaded = await s.store.load(file);
    const document = kind === 'asset' ? core.validateAsset(parse(loaded)) : core.validateSceneV2(parse(loaded));
    if (document[`${kind}Id`] !== id) throw Error('源文件身份不匹配');
    s.leases.set(file, loaded.hash);
    return { document, hash: loaded.hash, path: file };
  }
  async function commit(s, writes, document) {
    await s.store.commit(writes);
    const loaded = await s.store.load(PROJECT);
    s.document = document;
    s.projectHash = loaded.hash;
    for (const write of writes) if (write.path !== PROJECT && write.bytes !== null) {
      const item = await s.store.load(write.path);
      s.leases.set(write.path, item.hash);
    }
    const changed = writes.find((write) => write.path !== PROJECT);
    return { token: s.token, document: structuredClone(document),
      savedPath: changed?.path, hash: changed ? s.leases.get(changed.path) : null };
  }
  async function trashIndex(s) {
    const loaded = await s.store.loadOptional(TRASH);
    const data = loaded ? parse(loaded) : { version: 2, entries: [] };
    if (data.version !== 2 || !Array.isArray(data.entries) || data.entries.length > 10000)
      throw Error('项目回收区索引无效');
    return { data, hash: loaded?.hash ?? null };
  }
  function filesFor(row) {
    const files = row.kind === 'voxel' ? [row.source] : row.kind === 'texture' ? [row.image] : row.files;
    return [...files, ...(row.preview ? [row.preview.source] : [])];
  }
  async function moveFilesToTrash(s, trashId, files) {
    const writes = [], records = [];
    for (const file of files) {
      const loaded = await s.store.load(file);
      const target = `.workshop-trash/${trashId}/${file}`;
      writes.push({ path: target, bytes: loaded.bytes, expectedHash: null },
        { path: file, bytes: null, expectedHash: loaded.hash });
      records.push({ path: file, trashPath: target, hash: loaded.hash });
    }
    return { writes, records };
  }
  async function updateAfterTrash(s, writes, project) {
    await s.store.commit(writes);
    s.document = project; s.projectHash = (await s.store.load(PROJECT)).hash;
    for (const write of writes) if (write.path.startsWith('scenes/') && write.bytes !== null)
      s.leases.set(write.path, (await s.store.load(write.path)).hash);
    return { token: s.token, document: structuredClone(project) };
  }
  return {
    async copyProject(token, targetRoot, newName) {
      const s = current(token);
      if (typeof newName !== 'string' || !newName.trim() || newName.length > 200)
        throw Error('新项目名称无效');
      await projectOnDisk(s);
      const destination = path.resolve(targetRoot), parent = path.dirname(destination);
      const parentStat = await fs.lstat(parent);
      if (!parentStat.isDirectory() || parentStat.isSymbolicLink() ||
          path.resolve(await fs.realpath(parent)).toLowerCase() !== parent.toLowerCase())
        throw Error('新项目父目录无效');
      const nested = path.relative(path.resolve(s.root), destination);
      if (!nested || (!nested.startsWith('..') && !path.isAbsolute(nested)))
        throw Error('新项目目标必须位于原项目之外');
      if (await fs.lstat(destination).then(() => true, (error) => {
        if (error.code === 'ENOENT') return false; throw error;
      })) throw Error('新项目目标已存在');
      const document = core.validateProjectV2({ ...s.document,
        projectId: crypto.randomUUID(), name: newName.trim(), revision: 0 });
      const files = new Set();
      for (const row of s.document.assets) for (const file of filesFor(row)) files.add(file);
      for (const row of s.document.scenes) {
        files.add(row.source); if (row.preview) files.add(row.preview.source);
      }
      const stage = await fs.mkdtemp(path.join(parent, '.xh-tool008-copy-'));
      try {
        const target = createWorkshopStore(stage);
        const originals = new Map();
        const writes = [{ path: PROJECT, bytes: bytes(document), expectedHash: null }];
        for (const file of files) {
          const loaded = await s.store.load(file);
          originals.set(file, loaded.hash);
          writes.push({ path: file, bytes: loaded.bytes, expectedHash: null });
        }
        await target.commit(writes);
        const verified = core.validateProjectV2(parse(await target.load(PROJECT)));
        const sceneDocuments = [];
        for (const row of verified.scenes)
          sceneDocuments.push(core.validateSceneV2(parse(await target.load(row.source))));
        const issues = core.checkProjectSceneReferences(verified, sceneDocuments);
        if (issues.length) throw Error(`新项目引用校验失败：${issues.join('; ')}`);
        for (const row of verified.assets) {
          if (row.kind === 'voxel') {
            const asset = core.validateAsset(parse(await target.load(row.source)));
            if (asset.assetId !== row.assetId) throw Error('新项目资产身份不符');
          }
        }
        for (const [file, hash] of originals)
          if ((await s.store.load(file)).hash !== hash) throw Error(`复制时源文件已变化：${file}`);
        await projectOnDisk(s);
        if (await fs.lstat(destination).then(() => true, (error) => {
          if (error.code === 'ENOENT') return false; throw error;
        })) throw Error('新项目目标在复制期间被占用');
        await fs.rename(stage, destination);
        return { root: destination, projectId: document.projectId };
      } catch (error) {
        if (path.dirname(stage).toLowerCase() === parent.toLowerCase() &&
            path.basename(stage).startsWith('.xh-tool008-copy-'))
          await fs.rm(stage, { recursive: true, force: true });
        throw error;
      }
    },
    async create(root, document) {
      document = core.validateProjectV2(document);
      if (document.assets.length || document.scenes.length) throw Error('新项目必须为空');
      const store = createWorkshopStore(root);
      await store.commit([{ path: PROJECT, bytes: bytes(document), expectedHash: null }]);
      return attach(root, store);
    },
    async open(root) { return attach(root, createWorkshopStore(root)); },
    async renameProject(token, name) {
      const s = current(token);
      if (typeof name !== 'string' || !name.trim() || name.length > 200) throw Error('项目名称无效');
      const loaded = await projectOnDisk(s);
      const project = core.validateProjectV2({ ...s.document, name, revision: s.document.revision + 1 });
      return commit(s, [{ path: PROJECT, bytes: bytes(project), expectedHash: loaded.hash }], project);
    },
    dirty(token, value) { current(token).dirty = !!value; },
    isDirty() { return !!session?.dirty; },
    location(token) { return current(token).root; },
    async listAssetDirectory(token, folder = '') {
      const s = current(token);
      // The browser reads only the project's assets tree. Never follow links.
      core.assetSourcePath('probe', folder);
      const directory = path.join(s.root, 'assets', ...folder.split('/').filter(Boolean));
      let target = path.join(s.root, 'assets');
      for (const segment of folder.split('/').filter(Boolean)) {
        const stat = await fs.lstat(target).catch((error) => {
          if (error.code === 'ENOENT') return null; throw error;
        });
        if (stat?.isSymbolicLink() || (stat && !stat.isDirectory())) throw Error('资产目录无效');
        target = path.join(target, segment);
      }
      const stat = await fs.lstat(directory).catch((error) => {
        if (error.code === 'ENOENT') return null; throw error;
      });
      if (!stat) return [];
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw Error('资产目录无效');
      const entries = await fs.readdir(directory, { withFileTypes: true });
      const rows = [];
      for (const entry of entries) {
        const relative = folder ? `${folder}/${entry.name}` : entry.name;
        if (entry.isSymbolicLink()) { rows.push({ kind: 'link', name: entry.name, path: relative }); continue; }
        if (entry.isDirectory()) {
          const registered = s.document.assets.find((row) => row.kind === 'voxel' &&
            row.source === `assets/${relative}/asset.xhmodule.json`);
          const source = registered ? await fs.lstat(path.join(directory, entry.name,
            'asset.xhmodule.json')).catch((error) => {
            if (error.code === 'ENOENT') return null; throw error;
          }) : null;
          rows.push(registered && source?.isFile() && !source.isSymbolicLink()
            ? { kind: 'asset', name: registered.name, path: relative,
            assetId: registered.assetId } : { kind: 'directory', name: entry.name, path: relative });
        } else if (entry.isFile()) rows.push({ kind: 'file', name: entry.name, path: relative });
      }
      return rows.sort((a, b) => {
        const rank = { directory: 0, asset: 1, file: 2, link: 3 };
        return rank[a.kind] - rank[b.kind] || a.name.localeCompare(b.name, 'zh-CN');
      });
    },
    async loadAsset(token, id) {
      const s = current(token);
      const row = s.document.assets.find((item) => item.assetId === id);
      if (!row || row.kind !== 'voxel') throw Error('原生资产未登记');
      return loadRegistered(s, row.source, id, 'asset');
    },
    async loadScene(token, id) {
      const s = current(token);
      return loadRegistered(s, scenePath(id), id, 'scene');
    },
    async readBinary(token, id) {
      const s = current(token);
      const row = s.document.assets.find((item) => item.assetId === id);
      if (!row || row.kind === 'voxel') throw Error('二进制资产未登记');
      const file = row.kind === 'texture' ? row.image : row.model;
      const loaded = await s.store.load(file);
      return { row, data: Buffer.from(loaded.bytes).toString('base64') };
    },
    async saveAsset(token, input, previewBase64 = null, origin = null, folder = '') {
      const s = current(token);
      const document = core.validateAsset(input);
      const projectLoaded = await projectOnDisk(s);
      const project = structuredClone(s.document);
      const existing = project.assets.find((row) => row.assetId === document.assetId);
      if (existing && existing.kind !== 'voxel') throw Error('资产身份已被其他类型占用');
      if (existing && document.revision < existing.revision) throw Error('资产修订倒退');
      const file = existing ? existing.source : core.assetSourcePath(document.assetId, folder);
      if (existing && folder && file !== core.assetSourcePath(document.assetId, folder))
        throw Error('已保存资产的分类文件夹不可直接更改；请另存为新资产');
      const expectedHash = existing ? s.leases.get(file) : null;
      if (existing && !expectedHash) throw Error('请先读取当前原生资产，再保存');
      if (existing && (await s.store.load(file)).hash !== expectedHash) throw Error('资产已被外部修改');
      const sourceBytes = bytes(document);
      let previewBytes = null;
      if (previewBase64 !== null) {
        if (typeof previewBase64 !== 'string' || previewBase64.length > 4 * 1024 * 1024 ||
            !/^[A-Za-z0-9+/]+={0,2}$/.test(previewBase64)) throw Error('预览图片负载无效');
        previewBytes = Buffer.from(previewBase64, 'base64');
        core.pngBytes(previewBytes); validatePngIntegrity(previewBytes);
      }
      const previewPath = file.replace(/asset\.xhmodule\.json$/, 'preview.png');
      const previewPrior = await s.store.loadOptional(previewPath);
      const row = { kind: 'voxel', assetId: document.assetId, name: document.name,
        revision: document.revision, source: file,
        preview: previewBytes ? { source: previewPath, revision: document.revision,
          sourceHash: digest(sourceBytes) } : null,
        ...(existing?.origin ? { origin: existing.origin } : origin ? { origin } : {}) };
      if (existing) Object.assign(existing, row);
      else project.assets.push(row);
      project.revision++;
      core.validateProjectV2(project);
      return commit(s, [
        { path: PROJECT, bytes: bytes(project), expectedHash: projectLoaded.hash },
        { path: file, bytes: sourceBytes, expectedHash },
        ...(previewBytes ? [{ path: previewPath, bytes: previewBytes, expectedHash: previewPrior?.hash ?? null }]
          : previewPrior ? [{ path: previewPath, bytes: null, expectedHash: previewPrior.hash }] : []),
      ], project);
    },
    async saveScene(token, input, previewBase64 = null) {
      const s = current(token);
      const document = core.validateSceneV2(input);
      const assets = new Map(s.document.assets.map((row) => [row.assetId, row]));
      for (const instance of document.instances) {
        const row = assets.get(instance.assetId);
        if (!row || row.kind === 'texture') throw Error(`实例引用未知模型资产 ${instance.assetId}`);
      }
      for (const decal of document.decals) {
        const row = assets.get(decal.assetId);
        if (!row || row.kind !== 'texture') throw Error(`贴花引用未知图片资产 ${decal.assetId}`);
      }
      const projectLoaded = await projectOnDisk(s);
      const project = structuredClone(s.document);
      const existing = project.scenes.find((row) => row.sceneId === document.sceneId);
      if (existing && document.revision < existing.revision) throw Error('场景修订倒退');
      const file = scenePath(document.sceneId);
      const expectedHash = existing ? s.leases.get(file) : null;
      if (existing && !expectedHash) throw Error('请先读取当前场景，再保存');
      if (existing && (await s.store.load(file)).hash !== expectedHash) throw Error('场景已被外部修改');
      const sourceBytes = bytes(document);
      let previewBytes = null;
      if (previewBase64 !== null) {
        if (typeof previewBase64 !== 'string' || previewBase64.length > 4 * 1024 * 1024 ||
            !/^[A-Za-z0-9+/]+={0,2}$/.test(previewBase64)) throw Error('预览图片负载无效');
        previewBytes = Buffer.from(previewBase64, 'base64');
        core.pngBytes(previewBytes); validatePngIntegrity(previewBytes);
      }
      const previewPath = `scenes/${document.sceneId}/preview.png`;
      const previewPrior = await s.store.loadOptional(previewPath);
      const row = { sceneId: document.sceneId, name: document.name, revision: document.revision,
        source: file, preview: previewBytes ? { source: previewPath, revision: document.revision,
          sourceHash: digest(sourceBytes) } : null };
      if (existing) Object.assign(existing, row);
      else project.scenes.push(row);
      project.revision++;
      core.validateProjectV2(project);
      return commit(s, [
        { path: PROJECT, bytes: bytes(project), expectedHash: projectLoaded.hash },
        { path: file, bytes: sourceBytes, expectedHash },
        ...(previewBytes ? [{ path: previewPath, bytes: previewBytes, expectedHash: previewPrior?.hash ?? null }]
          : previewPrior ? [{ path: previewPath, bytes: null, expectedHash: previewPrior.hash }] : []),
      ], project);
    },
    async readPreview(token, kind, id) {
      const s = current(token);
      if (!['asset', 'scene'].includes(kind)) throw Error('预览类型无效');
      const row = (kind === 'asset' ? s.document.assets : s.document.scenes)
        .find((item) => item[`${kind}Id`] === id);
      if (!row?.preview) return null;
      const source = kind === 'asset' ? row.source ?? row.model ?? row.image : row.source;
      const loaded = await s.store.load(source);
      if (loaded.hash !== row.preview.sourceHash || row.preview.revision !== row.revision) return null;
      const image = await s.store.load(row.preview.source);
      core.pngBytes(image.bytes); validatePngIntegrity(Buffer.from(image.bytes));
      return Buffer.from(image.bytes).toString('base64');
    },
    async makeIndependent(token, sceneId, instanceId, previewBase64 = null) {
      const s = current(token);
      const projectLoaded = await projectOnDisk(s);
      const sceneLoaded = await this.loadScene(token, sceneId);
      const scene = structuredClone(sceneLoaded.document);
      const instance = scene.instances.find((item) => item.instanceId === instanceId);
      if (!instance) throw Error('所选实例不存在');
      const old = s.document.assets.find((item) => item.assetId === instance.assetId);
      if (!old || old.kind !== 'voxel') throw Error('只能独立化工坊原生模型实例');
      const sourceLoaded = await this.loadAsset(token, old.assetId);
      const newId = crypto.randomUUID();
      const asset = core.cloneAsset(sourceLoaded.document, newId);
      asset.name = `${sourceLoaded.document.name || '未命名'} 独立`;
      const assetBytes = bytes(asset);
      const oldParts = old.source.split('/');
      const newSource = core.assetSourcePath(newId, oldParts.slice(1, -2).join('/'));
      const oldPreview = old.preview ? await this.readPreview(token, 'asset', old.assetId) : null;
      const newPreview = oldPreview ? Buffer.from(oldPreview, 'base64') : null;
      const newPreviewPath = newSource.replace(/asset\.xhmodule\.json$/, 'preview.png');
      const project = structuredClone(s.document);
      project.assets.push({ kind: 'voxel', assetId: newId, name: asset.name,
        revision: asset.revision, source: newSource,
        preview: newPreview ? { source: newPreviewPath, revision: asset.revision,
          sourceHash: digest(assetBytes) } : null });
      instance.assetId = newId;
      scene.revision++;
      const sceneRow = project.scenes.find((item) => item.sceneId === sceneId);
      sceneRow.revision = scene.revision; sceneRow.preview = null;
      let previewBytes = null;
      const previewPath = `scenes/${sceneId}/preview.png`;
      const previewPrior = await s.store.loadOptional(previewPath);
      if (previewBase64 !== null) {
        if (typeof previewBase64 !== 'string' || previewBase64.length > 4 * 1024 * 1024 ||
            !/^[A-Za-z0-9+/]+={0,2}$/.test(previewBase64)) throw Error('预览图片负载无效');
        previewBytes = Buffer.from(previewBase64, 'base64');
        core.pngBytes(previewBytes); validatePngIntegrity(previewBytes);
        sceneRow.preview = { source: previewPath, revision: scene.revision, sourceHash: digest(bytes(scene)) };
      }
      project.revision++;
      core.validateProjectV2(project); core.validateSceneV2(scene);
      const writes = [
        { path: PROJECT, bytes: bytes(project), expectedHash: projectLoaded.hash },
        { path: scenePath(sceneId), bytes: bytes(scene), expectedHash: sceneLoaded.hash },
        { path: newSource, bytes: assetBytes, expectedHash: null },
        ...(newPreview ? [{ path: newPreviewPath, bytes: newPreview, expectedHash: null }] : []),
        ...(previewBytes ? [{ path: previewPath, bytes: previewBytes, expectedHash: previewPrior?.hash ?? null }]
          : previewPrior ? [{ path: previewPath, bytes: null, expectedHash: previewPrior.hash }] : []),
      ];
      await s.store.commit(writes);
      s.document = project; s.projectHash = (await s.store.load(PROJECT)).hash;
      const savedScene = await s.store.load(scenePath(sceneId));
      const savedAsset = await s.store.load(newSource);
      s.leases.set(scenePath(sceneId), savedScene.hash); s.leases.set(newSource, savedAsset.hash);
      return { project, scene, asset, sceneHash: savedScene.hash, assetHash: savedAsset.hash };
    },
    async copyScene(token, sourceId, newName) {
      const s = current(token);
      if (typeof newName !== 'string' || !newName.trim() || newName.length > 200) throw Error('场景名称无效');
      const projectLoaded = await projectOnDisk(s);
      const old = await this.loadScene(token, sourceId);
      const scene = structuredClone(old.document);
      scene.sceneId = crypto.randomUUID(); scene.name = newName; scene.revision = 0;
      scene.instances = scene.instances.map((item) => ({ ...item, instanceId: crypto.randomUUID() }));
      scene.decals = scene.decals.map((item) => ({ ...item, decalId: crypto.randomUUID() }));
      core.validateSceneV2(scene);
      const project = structuredClone(s.document);
      const sourceRow = project.scenes.find((item) => item.sceneId === sourceId);
      const oldPreview = sourceRow?.preview ? await this.readPreview(token, 'scene', sourceId) : null;
      const previewPath = `scenes/${scene.sceneId}/preview.png`;
      project.scenes.push({ sceneId: scene.sceneId, name: newName, revision: 0,
        source: scenePath(scene.sceneId), preview: oldPreview ? {
          source: previewPath, revision: 0, sourceHash: digest(bytes(scene)),
        } : null });
      project.revision++; core.validateProjectV2(project);
      await s.store.commit([
        { path: PROJECT, bytes: bytes(project), expectedHash: projectLoaded.hash },
        { path: scenePath(scene.sceneId), bytes: bytes(scene), expectedHash: null },
        ...(oldPreview ? [{ path: previewPath, bytes: Buffer.from(oldPreview, 'base64'), expectedHash: null }] : []),
      ]);
      s.document = project; s.projectHash = (await s.store.load(PROJECT)).hash;
      s.leases.set(scenePath(scene.sceneId), (await s.store.load(scenePath(scene.sceneId))).hash);
      return { token: s.token, document: structuredClone(project), sceneId: scene.sceneId };
    },
    async listTrash(token) {
      const s = current(token), index = await trashIndex(s);
      return index.data.entries.map((entry) => ({ trashId: entry.trashId, kind: entry.kind,
        name: entry.name, deletedAt: entry.deletedAt, references: entry.removed?.reduce((n, item) => n + item.instances.length + item.decals.length, 0) ?? 0 }));
    },
    async trashAsset(token, id, removeReferences = false) {
      const s = current(token);
      if (s.dirty) throw Error('请先保存更改，再移入回收区');
      const row = s.document.assets.find((item) => item.assetId === id);
      if (!row) throw Error('资产未登记');
      const projectLoaded = await projectOnDisk(s);
      const project = structuredClone(s.document);
      const removed = [], sceneWrites = [];
      for (const sceneRow of project.scenes) {
        const loaded = await s.store.load(sceneRow.source);
        const scene = core.validateSceneV2(parse(loaded));
        const instances = scene.instances.filter((item) => item.assetId === id);
        const decals = scene.decals.filter((item) => item.assetId === id);
        if (!instances.length && !decals.length) continue;
        removed.push({ sceneId: scene.sceneId, instances, decals });
        scene.instances = scene.instances.filter((item) => item.assetId !== id);
        scene.decals = scene.decals.filter((item) => item.assetId !== id);
        scene.revision++; sceneRow.revision = scene.revision; sceneRow.preview = null;
        sceneWrites.push({ path: sceneRow.source, bytes: bytes(scene), expectedHash: loaded.hash });
      }
      const count = removed.reduce((n, item) => n + item.instances.length + item.decals.length, 0);
      if (count && !removeReferences) throw Error(`资产被 ${count} 个试摆实例引用，请确认同时移除这些实例`);
      project.assets = project.assets.filter((item) => item.assetId !== id); project.revision++;
      core.validateProjectV2(project);
      const trashId = crypto.randomUUID();
      const moved = await moveFilesToTrash(s, trashId, filesFor(row));
      const index = await trashIndex(s);
      index.data.entries.unshift({ trashId, kind: 'project-asset', assetId: id, name: row.name,
        deletedAt: new Date().toISOString(), row, assetIndex: s.document.assets.indexOf(row),
        removed, files: moved.records });
      return updateAfterTrash(s, [
        { path: PROJECT, bytes: bytes(project), expectedHash: projectLoaded.hash },
        ...sceneWrites, ...moved.writes,
        { path: TRASH, bytes: bytes(index.data), expectedHash: index.hash },
      ], project);
    },
    async trashScene(token, id) {
      const s = current(token);
      if (s.dirty) throw Error('请先保存更改，再移入回收区');
      const row = s.document.scenes.find((item) => item.sceneId === id);
      if (!row) throw Error('场景未登记');
      const projectLoaded = await projectOnDisk(s);
      const project = structuredClone(s.document);
      project.scenes = project.scenes.filter((item) => item.sceneId !== id); project.revision++;
      core.validateProjectV2(project);
      const trashId = crypto.randomUUID();
      const moved = await moveFilesToTrash(s, trashId, [row.source, ...(row.preview ? [row.preview.source] : [])]);
      const index = await trashIndex(s);
      index.data.entries.unshift({ trashId, kind: 'scene', sceneId: id, name: row.name,
        deletedAt: new Date().toISOString(), row, sceneIndex: s.document.scenes.indexOf(row),
        files: moved.records });
      return updateAfterTrash(s, [
        { path: PROJECT, bytes: bytes(project), expectedHash: projectLoaded.hash },
        ...moved.writes, { path: TRASH, bytes: bytes(index.data), expectedHash: index.hash },
      ], project);
    },
    async restoreTrash(token, trashId) {
      const s = current(token);
      if (s.dirty) throw Error('请先保存更改，再从回收区恢复');
      const index = await trashIndex(s);
      const entry = index.data.entries.find((item) => item.trashId === trashId);
      if (!entry || !/^[a-f0-9-]{36}$/.test(trashId) || !['project-asset', 'scene'].includes(entry.kind))
        throw Error('回收区条目无效');
      const projectLoaded = await projectOnDisk(s);
      const project = structuredClone(s.document);
      const writes = [];
      if (entry.kind === 'project-asset') {
        if (project.assets.some((row) => row.assetId === entry.assetId)) throw Error('资产身份已被占用');
        project.assets.splice(Math.min(entry.assetIndex, project.assets.length), 0, entry.row);
        for (const removed of entry.removed) {
          const sceneRow = project.scenes.find((row) => row.sceneId === removed.sceneId);
          if (!sceneRow) throw Error('引用场景不存在，不能自动恢复实例');
          const loaded = await s.store.load(sceneRow.source), scene = core.validateSceneV2(parse(loaded));
          const occupied = new Set([...scene.instances.map((item) => item.instanceId), ...scene.decals.map((item) => item.decalId)]);
          if ([...removed.instances.map((item) => item.instanceId), ...removed.decals.map((item) => item.decalId)].some((id) => occupied.has(id)))
            throw Error('实例身份已被占用');
          scene.instances.push(...removed.instances); scene.decals.push(...removed.decals);
          scene.revision++; sceneRow.revision = scene.revision; sceneRow.preview = null;
          core.validateSceneV2(scene);
          writes.push({ path: sceneRow.source, bytes: bytes(scene), expectedHash: loaded.hash });
        }
      } else {
        if (project.scenes.some((row) => row.sceneId === entry.sceneId)) throw Error('场景身份已被占用');
        project.scenes.splice(Math.min(entry.sceneIndex, project.scenes.length), 0, entry.row);
      }
      project.revision++; core.validateProjectV2(project);
      const expectedFiles = entry.kind === 'project-asset'
        ? filesFor(entry.row)
        : [entry.row.source, ...(entry.row.preview ? [entry.row.preview.source] : [])];
      if (!Array.isArray(entry.files) || entry.files.length !== expectedFiles.length ||
          new Set(entry.files.map((file) => file.path)).size !== expectedFiles.length ||
          entry.files.some((file) => !expectedFiles.includes(file.path))) throw Error('回收文件组与登记不符');
      for (const file of entry.files) {
        if (typeof file.path !== 'string' || file.trashPath !== `.workshop-trash/${trashId}/${file.path}` ||
            !/^[a-f0-9]{64}$/.test(file.hash)) throw Error('回收文件身份无效');
        if (await s.store.loadOptional(file.path)) throw Error('原路径已被占用');
        const loaded = await s.store.load(file.trashPath);
        if (loaded.hash !== file.hash) throw Error('回收文件已改变');
        writes.push({ path: file.path, bytes: loaded.bytes, expectedHash: null },
          { path: file.trashPath, bytes: null, expectedHash: loaded.hash });
      }
      index.data.entries = index.data.entries.filter((item) => item.trashId !== trashId);
      return updateAfterTrash(s, [
        { path: PROJECT, bytes: bytes(project), expectedHash: projectLoaded.hash }, ...writes,
        { path: TRASH, bytes: bytes(index.data), expectedHash: index.hash },
      ], project);
    },
    async purgeTrash(token, trashId) {
      const s = current(token), index = await trashIndex(s);
      const entry = index.data.entries.find((item) => item.trashId === trashId);
      if (!entry || !/^[a-f0-9-]{36}$/.test(trashId) ||
          !['project-asset', 'scene'].includes(entry.kind)) throw Error('回收区条目无效');
      const expectedFiles = entry.kind === 'project-asset' ? filesFor(entry.row)
        : [entry.row.source, ...(entry.row.preview ? [entry.row.preview.source] : [])];
      if (!Array.isArray(entry.files) || entry.files.length !== expectedFiles.length ||
          entry.files.some((file) => !expectedFiles.includes(file.path) ||
            file.trashPath !== `.workshop-trash/${trashId}/${file.path}`)) throw Error('回收文件组无效');
      const writes = [];
      for (const file of entry.files) {
        const loaded = await s.store.load(file.trashPath);
        if (loaded.hash !== file.hash) throw Error('回收文件已改变');
        writes.push({ path: file.trashPath, bytes: null, expectedHash: loaded.hash });
      }
      index.data.entries = index.data.entries.filter((item) => item.trashId !== trashId);
      writes.push({ path: TRASH, bytes: bytes(index.data), expectedHash: index.hash });
      await s.store.commit(writes);
      return { trashId };
    },
  };
}
module.exports = { createWorkshopV2Repository };

/** Write a complete v2 copy beside the requested destination, then rename it into place. */
async function migrateV1Copy(sourceRoot, targetRoot, core, options = {}) {
  const destination = path.resolve(targetRoot);
  const parent = path.dirname(destination);
  const relativeTarget = path.relative(path.resolve(sourceRoot), destination);
  if (!relativeTarget || (!relativeTarget.startsWith('..') && !path.isAbsolute(relativeTarget)))
    throw Error('迁移目标必须在旧项目目录之外');
  const parentStat = await fs.lstat(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw Error('迁移目标父目录无效');
  if (await fs.lstat(destination).then(() => true, (e) => { if (e.code === 'ENOENT') return false; throw e; }))
    throw Error('迁移目标已存在，不能覆盖');
  const source = createWorkshopStore(sourceRoot);
  const oldProject = core.validateProject(parse(await source.load(PROJECT)));
  const scenes = [];
  const voxels = new Map();
  const binaries = new Map();
  const sourceHashes = {};
  const read = async (file) => {
    if (options.signal?.aborted) throw Error('迁移已取消');
    const loaded = await source.load(file);
    sourceHashes[file] = loaded.hash;
    return loaded;
  };
  sourceHashes[PROJECT] = (await source.load(PROJECT)).hash;
  for (const row of oldProject.scenes) {
    const scene = core.validateScene(parse(await read(row.source)));
    if (scene.sceneId !== row.sceneId || scene.name !== row.name) throw Error('旧场景登记与源不一致');
    scenes.push(scene);
    for (const asset of scene.assets) {
      if (asset.kind === 'voxel') {
        const file = `scenes/${scene.sceneId}/${asset.source}`;
        const document = core.validateAsset(parse(await read(file)));
        voxels.set(`${scene.sceneId}/${asset.assetId}`, document);
      } else {
        for (const local of asset.kind === 'texture' ? [asset.image] : asset.files) {
          const file = `scenes/${scene.sceneId}/${local}`;
          binaries.set(file, (await read(file)).bytes);
        }
      }
    }
  }
  const plan = core.planV1Migration(oldProject, scenes, voxels, () => crypto.randomUUID(), binaries);
  const stage = await fs.mkdtemp(path.join(parent, '.xh-tool008-migrate-'));
  try {
    if (options.signal?.aborted) throw Error('迁移已取消');
    const target = createWorkshopStore(stage);
    const writes = [
      { path: PROJECT, bytes: bytes(plan.project), expectedHash: null },
      ...plan.scenes.map((scene) => ({ path: scenePath(scene.sceneId), bytes: bytes(scene), expectedHash: null })),
      ...plan.assets.map((asset) => ({ path: asset.path, bytes: bytes(asset.document), expectedHash: null })),
      ...plan.binaries.map((binary) => ({ path: binary.path, bytes: Buffer.from(binary.bytes), expectedHash: null })),
      { path: 'migration-report.json', bytes: bytes({ ...plan.report, sourceHashes }), expectedHash: null },
    ];
    await target.commit(writes);
    const verifiedProject = core.validateProjectV2(parse(await target.load(PROJECT)));
    const verifiedScenes = [];
    for (const row of verifiedProject.scenes) verifiedScenes.push(core.validateSceneV2(parse(await target.load(row.source))));
    const issues = core.checkProjectSceneReferences(verifiedProject, verifiedScenes);
    if (issues.length) throw Error(`迁移后引用校验失败：${issues.join('; ')}`);
    for (const row of verifiedProject.assets) {
      if (row.kind === 'voxel') {
        const document = core.validateAsset(parse(await target.load(row.source)));
        if (document.assetId !== row.assetId) throw Error('迁移后资产身份不符');
      } else {
        for (const file of row.kind === 'texture' ? [row.image] : row.files) await target.load(file);
      }
    }
    if (options.signal?.aborted) throw Error('迁移已取消');
    if (await fs.lstat(destination).then(() => true, (e) => { if (e.code === 'ENOENT') return false; throw e; }))
      throw Error('迁移目标在执行期间被占用');
    await fs.rename(stage, destination);
    return { root: destination, report: { ...plan.report, sourceHashes } };
  } catch (error) {
    if (path.dirname(stage).toLowerCase() === parent.toLowerCase() && path.basename(stage).startsWith('.xh-tool008-migrate-'))
      await fs.rm(stage, { recursive: true, force: true });
    throw error;
  }
}
module.exports.migrateV1Copy = migrateV1Copy;
