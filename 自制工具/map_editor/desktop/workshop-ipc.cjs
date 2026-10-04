const crypto = require("node:crypto");
const { createWorkshopStore } = require("./workshop-store.cjs");
const PROJECT = "project.xhproject.json";
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let c = value;
  for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  return c >>> 0;
});
function validatePngIntegrity(bytes) {
  let offset = 8,
    ended = false;
  const compressed = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset),
      end = offset + 12 + length;
    if (end > bytes.length) throw Error("PNG块长度无效");
    let crc = 0xffffffff;
    for (let i = offset + 4; i < end - 4; i++)
      crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 255];
    if ((crc ^ 0xffffffff) >>> 0 !== bytes.readUInt32BE(end - 4))
      throw Error("PNG校验损坏");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") compressed.push(bytes.subarray(offset + 8, end - 4));
    offset = end;
    if (type === "IEND") {
      ended = true;
      break;
    }
  }
  if (!ended || offset !== bytes.length || !compressed.length)
    throw Error("PNG数据不完整");
  require("node:zlib").inflateSync(Buffer.concat(compressed), {
    maxOutputLength: 64 * 1024 * 1024,
  });
}
function createWorkshopBridge(core) {
  let session = null;
  let changingProject = false;
  const validators = {
    project: core.validateProject,
    scene: core.validateScene,
    asset: core.validateAsset,
  };
  const identities = {
    project: "projectId",
    scene: "sceneId",
    asset: "assetId",
  };
  function checkedBinary(kind, bytes) {
    if (kind === "texture") {
      core.pngBytes(bytes);
      validatePngIntegrity(Buffer.from(bytes));
    } else core.staticGlb(bytes);
  }
  function current(token) {
    if (!session || token !== session.token) throw Error("工坊项目会话已失效");
    return session;
  }
  function authorize(file, kind, id) {
    if (
      !validators[kind] ||
      typeof id !== "string" ||
      !/^[A-Za-z0-9_.-]{1,80}$/.test(id) ||
      id === "." ||
      id === ".."
    )
      throw Error("文档身份无效");
    const valid =
      kind === "project"
        ? file === PROJECT
        : kind === "scene"
          ? file === `scenes/${id}/scene.xhscene.json`
          : typeof file === "string" &&
            new RegExp(
              `^scenes/[A-Za-z0-9_-]{1,80}/assets/${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.xhmodule\\.json$`,
            ).test(file);
    if (!valid) throw Error("文档目标不属于指定会话");
  }
  function checked(kind, id, document) {
    const valid = validators[kind](document);
    if (valid[identities[kind]] !== id) throw Error("保存文档身份与目标不符");
    return valid;
  }
  function lease(s, file, kind, id, hash, document) {
    const prior = [...s.leases.values()].find((l) => l.path === file);
    if (prior && (prior.kind !== kind || prior.id !== id))
      throw Error("目标身份改变");
    const result = {
      leaseId: prior?.leaseId ?? crypto.randomUUID(),
      path: file,
      kind,
      id,
      hash,
    };
    s.leases.set(result.leaseId, result);
    return { ...result, document };
  }
  async function attach(root, document, store) {
    if (session?.publication)
      throw Error("发布正在进行，请等待完成或先取消发布");
    session = {
      token: crypto.randomUUID(),
      root,
      store,
      document,
      leases: new Map(),
      binaries: new Map(),
      dirty: false,
      projectHash: (await store.load(PROJECT)).hash,
    };
    return { token: session.token, name: document.name, document };
  }
  async function dependencies(s, writes) {
    const staged = new Map(
      writes.filter((w) => w.document).map((w) => [w.path, w.document]),
    );
    async function get(file, kind, id) {
      const document = staged.has(file)
        ? staged.get(file)
        : JSON.parse(
            Buffer.from((await s.store.load(file)).bytes).toString("utf8"),
          );
      return checked(kind, id, document);
    }
    const project = await get(PROJECT, "project", s.document.projectId);
    const registered = new Set([PROJECT]);
    for (const row of project.scenes) {
      registered.add(row.source);
      const scene = await get(row.source, "scene", row.sceneId);
      for (const asset of scene.assets)
        if (asset.kind === "voxel") {
          const file = `scenes/${scene.sceneId}/${asset.source}`;
          registered.add(file);
          await get(file, "asset", asset.assetId);
        } else {
          const pending = s.binaries.get(`${scene.sceneId}/${asset.assetId}`);
          if (pending && JSON.stringify(pending.row) !== JSON.stringify(asset))
            throw Error("资产登记与导入负载不符");
          const files = asset.kind === "texture" ? [asset.image] : asset.files;
          if (asset.kind === "external" && !files.includes(asset.model))
            throw Error("外部文件组缺少模型");
          for (const source of files) {
            const file = `scenes/${scene.sceneId}/${source}`;
            registered.add(file);
            const bytes =
              pending?.files.find((f) => f.path === file)?.bytes ??
              (await s.store.load(file)).bytes;
            if (
              source === (asset.kind === "texture" ? asset.image : asset.model)
            ) {
              checkedBinary(asset.kind, bytes);
            }
          }
          if (pending)
            for (const file of pending.files)
              writes.push({ ...file, expectedHash: null });
        }
    }
    for (const write of writes)
      if (!registered.has(write.path))
        throw Error("私有文档必须与场景登记一起保存");
    return project;
  }
  async function saveMigration(s, migration) {
    if (s.dirty) throw Error("请先保存当前项目，再导入或复制场景");
    const loaded = await s.store.load(PROJECT);
    if (loaded.hash !== s.projectHash)
      throw Error("项目已被外部修改，请重新打开");
    const project = core.validateProject(
        JSON.parse(Buffer.from(loaded.bytes).toString("utf8")),
      ),
      scene = core.validateScene(migration.scene),
      prefix = `scenes/${scene.sceneId}/`;
    project.scenes.push({
      sceneId: scene.sceneId,
      name: scene.name,
      source: prefix + "scene.xhscene.json",
    });
    project.revision++;
    core.validateProject(project);
    const json = (file, document, expectedHash = null) => ({
      path: file,
      bytes: Buffer.from(JSON.stringify(document, null, 2)),
      expectedHash,
    });
    const writes = [
      json(PROJECT, project, loaded.hash),
      json(prefix + "scene.xhscene.json", scene),
      json(prefix + "legacy/migration-report.json", migration.report),
    ];
    if (migration.legacyJson)
      writes.push({
        path: prefix + "legacy/original.xhmap.json",
        bytes: Buffer.from(migration.legacyJson),
        expectedHash: null,
      });
    for (const source of migration.modules)
      writes.push(
        json(
          prefix + `assets/${source.assetId}.xhmodule.json`,
          core.validateAsset(source),
        ),
      );
    for (const file of migration.copiedFiles)
      writes.push({
        path: prefix + file.path,
        bytes: Buffer.from(file.bytes),
        expectedHash: null,
      });
    await s.store.commit(writes);
    return {
      ...(await attach(s.root, project, s.store)),
      migration: {
        sceneId: scene.sceneId,
        issues: migration.issues,
        report: migration.report,
      },
    };
  }
  const api = {
    async publish(
      token,
      sceneId,
      assetId,
      publishId,
      recipe,
      toolchain,
      converter,
    ) {
      const s = current(token);
      if (s.dirty) throw Error("发布前请先保存草稿");
      if (s.publication) throw Error("已有发布正在进行");
      if (changingProject) throw Error("项目写入正在进行，请稍后发布");
      const controller = new AbortController();
      s.publication = controller;
      try {
        const capture =
          await require("./publish-source.cjs").capturePublishSource(
            s,
            core,
            sceneId,
            assetId,
          );
        if (capture.target.kind === "scene")
          for (const a of capture.target.assets.values())
            if (a.kind !== "voxel")
              checkedBinary(a.kind, a.kind === "texture" ? a.png : a.glb);
        const plan = await core.createPublishPlan(
          capture.target,
          publishId,
          recipe,
          toolchain,
        );
        plan.expectedInputs = capture.expectedInputs;
        return await require("./publish-store.cjs").commitPublish(
          s.root,
          plan,
          { signal: controller.signal, converter },
        );
      } finally {
        s.publication = null;
      }
    },
    cancelPublish(token) {
      current(token).publication?.abort();
    },
    async publishes(token) {
      return require("./publish-store.cjs").listPublishes(current(token).root);
    },
    async importLegacy(token, json, assets, sourceIssues = []) {
      const s = current(token);
      if (s.dirty) throw Error("请先保存当前项目，再导入旧图副本");
      const migration = core.migrateLegacy(json, assets, () =>
        crypto.randomUUID(),
      );
      migration.issues.push(...sourceIssues);
      migration.report.issues = migration.issues;
      return saveMigration(s, migration);
    },
    async copyScene(token, sceneId) {
      const s = current(token);
      if (s.dirty) throw Error("请先保存当前项目，再复制场景");
      authorize(`scenes/${sceneId}/scene.xhscene.json`, "scene", sceneId);
      if (!s.document.scenes.some((row) => row.sceneId === sceneId))
        throw Error("场景未在项目登记");
      const prefix = `scenes/${sceneId}/`,
        scene = core.validateScene(
          JSON.parse(
            Buffer.from(
              (await s.store.load(prefix + "scene.xhscene.json")).bytes,
            ).toString("utf8"),
          ),
        ),
        assets = new Map();
      for (const row of scene.assets) {
        try {
          if (row.kind === "voxel")
            assets.set(row.assetId, {
              kind: "voxel",
              document: core.validateAsset(
                JSON.parse(
                  Buffer.from(
                    (await s.store.load(prefix + row.source)).bytes,
                  ).toString("utf8"),
                ),
              ),
            });
          else if (row.kind === "texture")
            assets.set(row.assetId, {
              kind: "texture",
              revision: row.revision,
              png: (await s.store.load(prefix + row.image)).bytes,
            });
          else {
            const files = await Promise.all(
              row.files.map(async (file) => {
                const loaded = await s.store.load(prefix + file);
                return { path: file, bytes: loaded.bytes, sha256: loaded.hash };
              }),
            );
            assets.set(row.assetId, {
              kind: "external",
              revision: row.revision,
              anchorM: row.anchorM,
              recipe: row.recipe,
              glb: files.find((f) => f.path === row.model).bytes,
              files,
            });
          }
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
        }
      }
      const migration = core.copyWorkshopScene(scene, assets, () =>
        crypto.randomUUID(),
      );
      try {
        migration.legacyJson = Buffer.from(
          (await s.store.load(prefix + "legacy/original.xhmap.json")).bytes,
        ).toString("utf8");
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
      return saveMigration(s, migration);
    },
    async importBinary(token, sceneId, payload) {
      const s = current(token);
      authorize(`scenes/${sceneId}/scene.xhscene.json`, "scene", sceneId);
      if (!payload || !["texture", "external"].includes(payload.kind))
        throw Error("导入类型无效");
      const bytes = Buffer.from(payload.bytes),
        assetId = crypto.randomUUID();
      checkedBinary(payload.kind, bytes);
      const row =
        payload.kind === "texture"
          ? {
              kind: "texture",
              assetId,
              revision: 0,
              image: `textures/${assetId}.png`,
            }
          : {
              kind: "external",
              assetId,
              revision: 0,
              model: `external/${assetId}/model.glb`,
              files: [`external/${assetId}/model.glb`],
              anchorM: payload.anchorM ?? [0, 0, 0],
              recipe: "glb-rh-y-up",
            };
      const sample = core.createScene(sceneId);
      sample.assets.push(row);
      core.validateScene(sample);
      const source = row.kind === "texture" ? row.image : row.model;
      s.binaries.set(`${sceneId}/${assetId}`, {
        row,
        files: [{ path: `scenes/${sceneId}/${source}`, bytes }],
      });
      return structuredClone(row);
    },
    async readBinary(token, sceneId, assetId) {
      const s = current(token);
      authorize(`scenes/${sceneId}/scene.xhscene.json`, "scene", sceneId);
      const pending = s.binaries.get(`${sceneId}/${assetId}`);
      let row = pending?.row;
      if (!row) {
        const doc = core.validateScene(
          JSON.parse(
            Buffer.from(
              (await s.store.load(`scenes/${sceneId}/scene.xhscene.json`))
                .bytes,
            ).toString("utf8"),
          ),
        );
        row = doc.assets.find(
          (a) => a.assetId === assetId && a.kind !== "voxel",
        );
      }
      if (!row) throw Error("二进制资产未登记");
      const source = row.kind === "texture" ? row.image : row.model,
        file = `scenes/${sceneId}/${source}`;
      const bytes =
        pending?.files.find((f) => f.path === file)?.bytes ??
        (await s.store.load(file)).bytes;
      checkedBinary(row.kind, bytes);
      return {
        row: structuredClone(row),
        data: Buffer.from(bytes).toString("base64"),
      };
    },
    async create(root, document) {
      document = core.validateProject(document);
      if (document.scenes.length)
        throw Error("新项目必须为空，场景与模块通过文件组创建");
      const store = createWorkshopStore(root);
      await store.commit([
        {
          path: PROJECT,
          bytes: Buffer.from(JSON.stringify(document, null, 2)),
          expectedHash: null,
        },
      ]);
      return attach(root, document, store);
    },
    async open(root) {
      const store = createWorkshopStore(root),
        opened = await store.load(PROJECT);
      const document = core.validateProject(
        JSON.parse(Buffer.from(opened.bytes).toString("utf8")),
      );
      return attach(root, document, store);
    },
    async load(token, file, kind, id) {
      const s = current(token);
      authorize(file, kind, id);
      const opened = await s.store.load(file),
        document = checked(
          kind,
          id,
          JSON.parse(Buffer.from(opened.bytes).toString("utf8")),
        );
      return lease(s, file, kind, id, opened.hash, document);
    },
    async stage(token, file, kind, id) {
      const s = current(token);
      authorize(file, kind, id);
      // The null hash is owned by the main process, never accepted from the renderer.
      return lease(s, file, kind, id, null, null);
    },
    async commit(token, intents) {
      const s = current(token);
      if (!Array.isArray(intents) || !intents.length || intents.length > 10000)
        throw Error("文档文件组无效");
      const writes = intents.map((intent) => {
        const target = s.leases.get(intent.leaseId);
        if (!target) throw Error("未授权的保存目标");
        const document = checked(target.kind, target.id, intent.document);
        return {
          ...target,
          document,
          bytes: Buffer.from(JSON.stringify(document, null, 2)),
          expectedHash: target.hash,
        };
      });
      const project = await dependencies(s, writes);
      const result = await s.store.commit(writes);
      for (const write of writes.filter((w) => w.leaseId))
        s.leases.get(write.leaseId).hash = result.files.find(
          (f) => f.path === write.path,
        ).hash;
      s.document = project;
      s.projectHash =
        result.files.find((f) => f.path === PROJECT)?.hash ?? s.projectHash;
      for (const [key, pending] of s.binaries)
        if (
          pending.files.every((f) =>
            result.files.some((saved) => saved.path === f.path),
          )
        )
          s.binaries.delete(key);
      // Renderer reports remaining dirty sessions after acknowledging the submitted revisions.
      return result;
    },
    dirty(token, value) {
      current(token).dirty = !!value;
    },
    isDirty() {
      return !!(session?.dirty || session?.publication);
    },
  };
  for (const name of [
    "create",
    "open",
    "importLegacy",
    "copyScene",
    "commit",
    "importBinary",
  ]) {
    const operation = api[name];
    api[name] = async (...args) => {
      if (session?.publication)
        throw Error("发布正在进行，请等待完成或先取消发布");
      if (changingProject) throw Error("项目写入正在进行，请稍后重试");
      changingProject = true;
      try {
        return await operation(...args);
      } finally {
        changingProject = false;
      }
    };
  }
  return api;
}
module.exports = { createWorkshopBridge, validatePngIntegrity };
