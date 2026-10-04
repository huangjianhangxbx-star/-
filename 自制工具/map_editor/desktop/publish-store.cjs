const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { digest } = require("./files.cjs");
const { isDeepStrictEqual } = require("node:util");
const { createWorkshopStore } = require("./workshop-store.cjs");
function abort(signal) {
  if (signal?.aborted) throw Error("发布已取消");
}
function relative(file) {
  if (
    typeof file !== "string" ||
    file.length > 1024 ||
    /[\\:\x00-\x1f<>"|?*]/.test(file) ||
    file
      .split("/")
      .some(
        (p) =>
          !p ||
          p === "." ||
          p === ".." ||
          /[. ]$/.test(p) ||
          /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(p),
      )
  )
    throw Error("发布路径无效或越界");
  return file;
}
async function checkedRoot(root) {
  const absolute = path.resolve(root);
  if (
    (await fs.lstat(absolute)).isSymbolicLink() ||
    path.resolve(await fs.realpath(absolute)).toLowerCase() !==
      absolute.toLowerCase()
  )
    throw Error("发布根目录不能是链接");
  const directory = path.join(absolute, "releases");
  await fs.mkdir(directory, { recursive: true });
  if ((await fs.lstat(directory)).isSymbolicLink())
    throw Error("发布目录不能是链接");
  return directory;
}
function validateClosure(manifest, files, completed = true) {
  if (
    !manifest ||
    manifest.schema !== "xinghai-workshop-publish-1" ||
    !/^[A-Za-z0-9_-]{1,80}$/.test(manifest.publishId) ||
    !["asset", "scene"].includes(manifest.kind) ||
    manifest.unit !== "meters" ||
    manifest.sourceAxes !== "RH_Z_UP" ||
    manifest.voxelSize !== 0.25 ||
    !["glb-only", "glb-fbx"].includes(manifest.recipe) ||
    !Number.isSafeInteger(manifest.sourceRevision) ||
    manifest.sourceRevision < 0 ||
    !Array.isArray(manifest.dependencies) ||
    !Array.isArray(manifest.payloadFiles) ||
    !Array.isArray(manifest.outputFiles)
  )
    throw Error("发布manifest无效");
  const entries = [...manifest.payloadFiles, ...manifest.outputFiles],
    byPath = new Map();
  for (const entry of entries) {
    relative(entry.path);
    if (
      (entry.path.startsWith("payload/")
        ? manifest.payloadFiles
        : manifest.outputFiles
      ).indexOf(entry) < 0 ||
      (!entry.path.startsWith("payload/source/") &&
        !entry.path.startsWith("payload/runtime/") &&
        !entry.path.startsWith("output/"))
    )
      throw Error("发布文件分区无效");
    const key = entry.path.toLowerCase();
    if (byPath.has(key)) throw Error("发布闭包路径重复");
    if (
      !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      !Number.isSafeInteger(entry.byteLength) ||
      entry.byteLength < 1
    )
      throw Error("发布hash或长度无效");
    byPath.set(key, entry);
  }
  if (files.length !== entries.length) throw Error("发布闭包缺少或多出文件");
  const supplied = new Set();
  for (const f of files) {
    relative(f.path);
    const key = f.path.toLowerCase(),
      entry = byPath.get(key);
    if (supplied.has(key) || !entry || entry.path !== f.path)
      throw Error("发布闭包文件不匹配");
    supplied.add(key);
    if (
      digest(f.bytes) !== entry.sha256 ||
      f.bytes.length !== entry.byteLength ||
      (f.sha256 && f.sha256 !== entry.sha256)
    )
      throw Error("发布文件hash损坏");
  }
  function exists(file) {
    relative(file);
    if (!byPath.has(file.toLowerCase())) throw Error("发布闭包缺少绑定文件");
  }
  exists(manifest.runtimePath);
  exists("output/target.glb");
  if (completed && manifest.recipe === "glb-fbx") {
    exists("output/target.fbx");
    exists("output/target.xhmaterials.json");
    if (
      manifest.toolchain?.blenderVersion !== "5.1.2" ||
      manifest.toolchain?.fbxRecipe !== "blender-fbx-5.1.2" ||
      manifest.dependencies.some(
        (d) => d.kind === "external" && d.unity?.route !== "fbx",
      )
    )
      throw Error("FBX配方没有完整资产级绑定");
  }
  const ids = new Set();
  for (const d of manifest.dependencies) {
    if (
      !/^[A-Za-z0-9_.-]{1,80}$/.test(d.assetId) ||
      ids.has(d.assetId) ||
      !["voxel", "texture", "external"].includes(d.kind) ||
      !Number.isSafeInteger(d.sourceRevision) ||
      d.sourceRevision < 0 ||
      !/^[a-f0-9]{64}$/.test(d.contentHash)
    )
      throw Error("冻结依赖身份或绑定无效");
    ids.add(d.assetId);
    exists(d.sourcePath);
    if (d.glbPath) exists(d.glbPath);
    const u = d.unity;
    if (!u) throw Error("缺少Unity绑定");
    if (u.route === "native-cells" && d.kind === "voxel") exists(u.runtimePath);
    else if (u.route === "texture" && d.kind === "texture") exists(u.imagePath);
    else if (u.route === "fbx" && d.kind === "external") {
      if (u.recipe !== "blender-fbx-5.1.2" || !Array.isArray(u.texturePaths))
        throw Error("FBX绑定配方无效");
      exists(u.modelPath);
      exists(u.materialsPath);
      for (const p of u.texturePaths) exists(p);
    } else if (!(u.route === "unsupported-glb" && d.kind === "external"))
      throw Error("Unity绑定类型无效");
  }
  const bytes = new Map(files.map((f) => [f.path, Buffer.from(f.bytes)])),
    readJSON = (file) => JSON.parse(bytes.get(file).toString("utf8")),
    core = require("../dist/workshop.cjs");
  for (const dependency of manifest.dependencies) {
    const directory = `payload/source/assets/${dependency.assetId}/`,
      sourceFiles = manifest.payloadFiles
        .filter(
          (f) =>
            f.path === dependency.sourcePath || f.path.startsWith(directory),
        )
        .map((f) => ({
          path: f.path,
          sha256: f.sha256,
          byteLength: f.byteLength,
        }))
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    if (
      digest(Buffer.from(JSON.stringify(sourceFiles))) !==
      dependency.contentHash
    )
      throw Error("冻结contentHash绑定损坏");
    if (dependency.kind === "voxel") {
      const source = core.validateAsset(readJSON(dependency.sourcePath)),
        runtime = readJSON(dependency.unity.runtimePath),
        { editor, ...expected } = source;
      if (
        source.assetId !== dependency.assetId ||
        source.revision !== dependency.sourceRevision ||
        !isDeepStrictEqual(source.anchorM, dependency.anchorM) ||
        !isDeepStrictEqual(runtime, expected)
      )
        throw Error("runtime与冻结模块不符或含制作参考");
    } else if (dependency.kind === "texture") {
      core.pngBytes(bytes.get(dependency.sourcePath));
      require("./workshop-ipc.cjs").validatePngIntegrity(
        bytes.get(dependency.sourcePath),
      );
    }
  }
  const runtime = readJSON(manifest.runtimePath);
  if (manifest.kind === "asset") {
    if (
      manifest.dependencies.length !== 1 ||
      manifest.dependencies[0].kind !== "voxel" ||
      runtime.assetId !== manifest.targetId ||
      runtime.revision !== manifest.sourceRevision
    )
      throw Error("冻结单件目标绑定不符");
  } else {
    const scene = core.validateScene(
        readJSON("payload/source/scene.xhscene.json"),
      ),
      expected = {
        schema: "xinghai-workshop-runtime-scene-1",
        sceneId: scene.sceneId,
        revision: scene.revision,
        name: scene.name,
        voxelSize: 0.25,
        bindings: manifest.dependencies.map((d) => ({
          assetId: d.assetId,
          sourceRevision: d.sourceRevision,
          contentHash: d.contentHash,
        })),
        instances: scene.instances,
        groups: scene.groups,
        decals: scene.decals,
      };
    if (
      scene.sceneId !== manifest.targetId ||
      scene.revision !== manifest.sourceRevision ||
      scene.assets.length !== manifest.dependencies.length ||
      scene.assets.some(
        (row) =>
          !manifest.dependencies.some(
            (d) => d.assetId === row.assetId && d.kind === row.kind,
          ),
      ) ||
      !isDeepStrictEqual(runtime, expected)
    )
      throw Error("runtime场景冻结绑定不符");
  }
  for (const [file, data] of bytes)
    if (file.endsWith(".glb")) {
      const { json, bin } = core.validatePublishGlb(data);
      for (const image of json.images ?? [])
        if (
          image.mimeType === "image/png" ||
          image.uri?.startsWith("data:image/png;base64,")
        ) {
          const view =
              image.bufferView !== undefined
                ? json.bufferViews[image.bufferView]
                : null,
            png = view
              ? Buffer.from(
                  bin.subarray(
                    view.byteOffset ?? 0,
                    (view.byteOffset ?? 0) + view.byteLength,
                  ),
                )
              : Buffer.from(image.uri.split(",")[1], "base64");
          core.pngBytes(png);
          require("./workshop-ipc.cjs").validatePngIntegrity(png);
        }
    }
  return manifest;
}
async function inputCheck(root, inputs) {
  const store = createWorkshopStore(root);
  for (const input of inputs) {
    relative(input.path);
    if ((await store.load(input.path)).hash !== input.sha256)
      throw Error("发布输入已被外部修改");
  }
}
async function durable(file, bytes) {
  const handle = await fs.open(file, "wx");
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function scan(directory) {
  const files = [];
  async function visit(relativeDir = "") {
    for (const entry of await fs.readdir(path.join(directory, relativeDir), {
      withFileTypes: true,
    })) {
      const name = relativeDir ? relativeDir + "/" + entry.name : entry.name;
      if (entry.isSymbolicLink()) throw Error("发布闭包不允许链接");
      if (entry.isDirectory()) await visit(name);
      else if (entry.isFile()) {
        if (name === "manifest.json") continue;
        const bytes = await fs.readFile(path.join(directory, name));
        files.push({ path: name, bytes, sha256: digest(bytes) });
      } else throw Error("发布闭包文件类型无效");
    }
  }
  await visit();
  return files;
}
async function removeOwnStage(directory, publishRoot) {
  const resolved = path.resolve(directory),
    rel = path.relative(publishRoot, resolved);
  if (
    path.isAbsolute(rel) ||
    rel.startsWith("..") ||
    !path.basename(resolved).startsWith(".staging-")
  )
    throw Error("拒绝清理非本次发布暂存");
  await fs.rm(resolved, { recursive: true, force: true });
}
async function acquireLock(lockFile, stage, publishRoot) {
  let lock;
  try {
    lock = await fs.open(lockFile, "wx");
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    const stat = await fs.lstat(lockFile);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 4096)
      throw Error("发布锁文件无效");
    const record = JSON.parse(await fs.readFile(lockFile, "utf8"));
    if (
      record.schema !== "xinghai-publish-lock-1" ||
      !Number.isSafeInteger(record.pid) ||
      record.pid < 1 ||
      typeof record.stage !== "string" ||
      !/^\.staging-[A-Za-z0-9_-]+-[a-f0-9-]{36}$/.test(record.stage)
    )
      throw Error("发布锁记录无效");
    try {
      process.kill(record.pid, 0);
      throw Error("该发布身份正在写入");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
    await removeOwnStage(path.join(publishRoot, record.stage), publishRoot);
    await fs.unlink(lockFile);
    lock = await fs.open(lockFile, "wx");
  }
  try {
    await lock.writeFile(
      JSON.stringify({
        schema: "xinghai-publish-lock-1",
        pid: process.pid,
        stage: path.basename(stage),
      }),
    );
    await lock.sync();
    return lock;
  } catch (e) {
    await lock.close();
    await fs.unlink(lockFile);
    throw e;
  }
}
async function commitPublish(root, input, options = {}) {
  const plan = structuredClone(input),
    signal = options.signal;
  abort(signal);
  const publishRoot = await checkedRoot(root),
    id = plan.manifest?.publishId;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw Error("发布身份无效");
  const destination = path.join(publishRoot, id),
    stage = path.join(
      publishRoot,
      ".staging-" + id + "-" + crypto.randomUUID(),
    ),
    lockFile = path.join(publishRoot, ".lock-" + id);
  let lock,
    committed = false;
  try {
    lock = await acquireLock(lockFile, stage, publishRoot);
    if (
      await fs.lstat(destination).catch((e) => {
        if (e.code === "ENOENT") return null;
        throw e;
      })
    )
      throw Error("该发布身份已经存在");
    validateClosure(plan.manifest, plan.files, false);
    await inputCheck(root, plan.expectedInputs ?? []);
    abort(signal);
    await fs.mkdir(stage);
    for (const f of plan.files) {
      abort(signal);
      const file = path.join(stage, relative(f.path));
      await fs.mkdir(path.dirname(file), { recursive: true });
      await durable(file, Buffer.from(f.bytes));
    }
    let manifest = plan.manifest;
    if (manifest.recipe === "glb-fbx") {
      if (!options.converter) throw Error("FBX配方缺少转换器");
      manifest = await options.converter(
        stage,
        structuredClone(manifest),
        signal,
      );
      if (manifest.publishId !== id || manifest.recipe !== "glb-fbx")
        throw Error("转换器改变发布身份或配方");
    }
    abort(signal);
    const actual = await scan(stage);
    validateClosure(manifest, actual);
    await inputCheck(root, plan.expectedInputs ?? []);
    abort(signal);
    await durable(
      path.join(stage, "manifest.json"),
      Buffer.from(JSON.stringify(manifest, null, 2)),
    );
    abort(signal);
    if (
      await fs.lstat(destination).catch((e) => {
        if (e.code === "ENOENT") return null;
        throw e;
      })
    )
      throw Error("该发布身份已经存在");
    for (let attempt = 0; ; attempt++) {
      abort(signal);
      if (
        await fs.lstat(destination).catch((e) => {
          if (e.code === "ENOENT") return null;
          throw e;
        })
      )
        throw Error("该发布身份已经存在");
      try {
        await fs.rename(stage, destination);
        break;
      } catch (e) {
        if (!["EPERM", "EBUSY"].includes(e.code) || attempt >= 3) throw e;
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }
    committed = true;
    return { publishId: id, directory: destination };
  } finally {
    if (!committed) await removeOwnStage(stage, publishRoot);
    if (lock) {
      await lock.close();
      await fs.unlink(lockFile);
    }
  }
}
async function listPublishes(root) {
  const directory = await checkedRoot(root),
    published = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (
      entry.name.startsWith(".") ||
      !entry.isDirectory() ||
      entry.isSymbolicLink()
    )
      continue;
    try {
      const target = path.join(directory, entry.name),
        file = path.join(target, "manifest.json");
      if ((await fs.lstat(file)).isSymbolicLink()) continue;
      const manifest = JSON.parse(await fs.readFile(file, "utf8"));
      if (manifest.publishId !== entry.name) continue;
      validateClosure(manifest, await scan(target));
      published.push({
        publishId: manifest.publishId,
        directory: target,
        manifest,
      });
    } catch {
      /* Incomplete or damaged folders are not effective published versions. */
    }
  }
  return published;
}
module.exports = { commitPublish, listPublishes, validateClosure };
